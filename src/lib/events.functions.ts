import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  calculateTicketPrice,
  hasCapacity,
  isRegistrationOpen,
  isDuplicateRegistration,
  type PriceResult,
} from "./pricing";

const slugSchema = z.object({ slug: z.string().min(1).max(200) });
const ticketSchema = z.object({ ticketTypeId: z.string().uuid() });

export type EventTicketOption = {
  id: string;
  name: string;
  description: string | null;
  price: PriceResult;
  spotsLeft: number | null;
  soldOut: boolean;
};

export type EventDetail = {
  event: {
    id: string;
    title: string;
    slug: string;
    eventType: string;
    shortDescription: string | null;
    description: string | null;
    heroImageUrl: string | null;
    galleryUrls: string[];
    startDate: string;
    endDate: string | null;
    venue: string | null;
    address: string | null;
    capacity: number | null;
    status: string;
    featured: boolean;
  };
  speakers: {
    id: string;
    name: string;
    slug: string;
    jobTitle: string | null;
    company: string | null;
    photoUrl: string | null;
    bio: string | null;
  }[];
  workshops: {
    id: string;
    title: string;
    description: string | null;
    startTime: string | null;
    location: string | null;
    basePrice: number;
    speakerName: string | null;
  }[];
  partners: { id: string; name: string; tier: string | null; websiteUrl: string | null }[];
  tickets: EventTicketOption[];
  registrationOpen: boolean;
  spotsLeft: number | null;
  membershipName: string | null;
  isSignedIn: boolean;
  myRegistration: { id: string; status: string; pricePaid: number; currency: string } | null;
};

export const getEventDetail = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => slugSchema.parse(data))
  .handler(async ({ data }): Promise<EventDetail | null> => {
    const { getReadClient, assertDatabaseResult } = await import("./database.server");
    const canReadAllRegistrations = !!process.env["SUPABASE_SERVICE_ROLE_KEY"];
    const supabaseAdmin = canReadAllRegistrations
      ? (await import("@/integrations/supabase/client.server")).supabaseAdmin
      : getReadClient();
    const { getOptionalUser } = await import("./auth.server");
    const { getCurrentMembership, getUserEntitlements } = await import("./membership.server");

    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();

    assertDatabaseResult({ error: eventError });
    if (!event) return null;

    const user = await getOptionalUser();
    const isAdminViewer = user
      ? !!(await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", user.userId)
          .eq("role", "admin")
          .maybeSingle()
          .then((r) => r.data))
      : false;

    if (event.publish_state !== "published" && !isAdminViewer) return null;

    const [speakersRes, workshopsRes, partnersRes, ticketsRes, regsRes] = await Promise.all([
      supabaseAdmin
        .from("event_speakers")
        .select("sort_order,speakers(id,name,slug,job_title,company,photo_url,bio)")
        .eq("event_id", event.id)
        .order("sort_order"),
      supabaseAdmin
        .from("workshops")
        .select("id,title,description,start_time,location,base_price,speakers(name)")
        .eq("event_id", event.id)
        .order("start_time"),
      supabaseAdmin
        .from("event_partners")
        .select("partners(id,name,tier,website_url)")
        .eq("event_id", event.id),
      supabaseAdmin
        .from("ticket_types")
        .select("*")
        .eq("event_id", event.id)
        .eq("active", true)
        .order("sort_order"),
      (user || canReadAllRegistrations) ? supabaseAdmin
        .from("registrations")
        .select("id,status,ticket_type_id,user_id,price_paid,currency")
        .eq("event_id", event.id)
        .in("status", ["pending", "confirmed", "checked_in"]) : Promise.resolve({ data: [], error: null }),
    ]);

    [speakersRes, workshopsRes, partnersRes, ticketsRes, regsRes].forEach(assertDatabaseResult);
    const registrations = regsRes.data ?? [];
    const entitlements = await getUserEntitlements(user?.userId);
    const membership = await getCurrentMembership(user?.userId);

    const tickets: EventTicketOption[] = (ticketsRes.data ?? []).map((ticket) => {
      const taken = registrations.filter((r) => r.ticket_type_id === ticket.id).length;
      const spotsLeft = !canReadAllRegistrations || ticket.capacity === null ? null : Math.max(ticket.capacity - taken, 0);
      return {
        id: ticket.id,
        name: ticket.name,
        description: ticket.description,
        price: calculateTicketPrice(
          {
            basePrice: Number(ticket.base_price),
            currency: ticket.currency,
            requiredEntitlement: ticket.required_entitlement,
            discountEntitlement: ticket.discount_entitlement,
            freeEntitlement: ticket.free_entitlement,
          },
          entitlements,
        ),
        spotsLeft,
        soldOut: event.event_status === "sold_out" || (spotsLeft !== null && spotsLeft === 0),
      };
    });

    const mine = user ? registrations.find((r) => r.user_id === user.userId) : undefined;

    return {
      event: {
        id: event.id,
        title: event.title,
        slug: event.slug,
        eventType: event.event_type,
        shortDescription: event.short_description,
        description: event.description,
        heroImageUrl: event.hero_image_url,
        galleryUrls: Array.isArray(event.gallery_urls) ? event.gallery_urls.filter((url): url is string => typeof url === "string") : [],
        startDate: event.start_date,
        endDate: event.end_date,
        venue: event.venue,
        address: event.address,
        capacity: event.capacity,
        status: event.event_status,
        featured: event.featured,
      },
      speakers: (speakersRes.data ?? [])
        .map((row) => row.speakers)
        .filter(Boolean)
        .map((s) => ({
          id: s!.id,
          name: s!.name,
          slug: s!.slug,
          jobTitle: s!.job_title,
          company: s!.company,
          photoUrl: s!.photo_url,
          bio: s!.bio,
        })),
      workshops: (workshopsRes.data ?? []).map((w) => ({
        id: w.id,
        title: w.title,
        description: w.description,
        startTime: w.start_time,
        location: w.location,
        basePrice: Number(w.base_price),
        speakerName: w.speakers?.name ?? null,
      })),
      partners: (partnersRes.data ?? [])
        .map((row) => row.partners)
        .filter(Boolean)
        .map((p) => ({ id: p!.id, name: p!.name, tier: p!.tier, websiteUrl: p!.website_url })),
      tickets,
      registrationOpen: isRegistrationOpen({
        status: event.event_status,
        registrationStart: event.registration_start,
        registrationEnd: event.registration_end,
      }),
      spotsLeft: !canReadAllRegistrations || event.capacity === null ? null : Math.max(event.capacity - registrations.length, 0),
      membershipName: membership?.plan.name ?? null,
      isSignedIn: !!user,
      myRegistration: mine
        ? {
            id: mine.id,
            status: mine.status,
            pricePaid: Number(mine.price_paid),
            currency: mine.currency,
          }
        : null,
    };
  });

/** Prototype reservation: trusted price is saved, no payment is collected. */
export const reserveFreePlace = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ticketSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireUser } = await import("./auth.server");
    const user = await requireUser();
    const { getReadClient } = await import("./database.server");
    const db = getReadClient();
    const { data: ticket, error: ticketError } = await db.from("ticket_types")
      .select("events(slug)").eq("id", data.ticketTypeId).single();
    if (ticketError || !ticket?.events) throw new Error("This ticket is not available.");
    // Authentication, entitlements, duplicate protection and seats are checked in one transaction.
    const { data: created, error } = await db.rpc("register_prototype_ticket", { p_ticket_type_id: data.ticketTypeId });

    if (error) {
      if (error.code === "23505") throw new Error("You are already registered for this event.");
      if (error.code === "P0001") throw new Error(error.message);
      if (error.code === "PGRST202") throw new Error("Registration is not ready yet. Please contact CometX.");
      throw new Error("We could not save your registration. Please try again.");
    }

    return { registrationId: created, eventSlug: ticket.events.slug, reason: "Your place is confirmed" };
  });
