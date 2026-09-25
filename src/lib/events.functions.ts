import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  calculateTicketPrice,
  hasCapacity,
  isRegistrationOpen,
  isDuplicateRegistration,
  type PriceResult,
} from "./pricing";

const slugSchema = z.object({ slug: z.string().min(1).max(200), preview: z.boolean().optional() });
const checkoutSchema = z.object({
  lines: z.array(z.object({ ticketTypeId: z.string().uuid(), quantity: z.number().int().min(1).max(10) })).min(1).max(10),
  buyerName: z.string().max(240).optional(), buyerEmail: z.string().email().max(320).optional(),
}).superRefine((value, ctx) => {
  if (new Set(value.lines.map((line) => line.ticketTypeId)).size !== value.lines.length) ctx.addIssue({ code: "custom", message: "Choose each ticket type once." });
  if (value.lines.reduce((sum, line) => sum + line.quantity, 0) > 10) ctx.addIssue({ code: "custom", message: "Choose no more than 10 tickets per order." });
});

export type EventTicketOption = {
  id: string;
  name: string;
  description: string | null;
  memberPrice: number | null;
  saleStart: string | null;
  saleEnd: string | null;
  price: PriceResult;
  spotsLeft: number | null;
  soldOut: boolean;
  hasMemberPricing: boolean;
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
    registrationStart: string | null;
    registrationEnd: string | null;
    publishState: string;
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
  isPreview: boolean;
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

    const privateOrderDb = supabaseAdmin as unknown as SupabaseClient;
    const [speakersRes, workshopsRes, partnersRes, ticketsRes, regsRes, attendeesRes, openOrdersRes] = await Promise.all([
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
      canReadAllRegistrations ? privateOrderDb.from("ticket_attendees").select("ticket_type_id").eq("event_id", event.id).in("status", ["valid", "checked_in"]) : Promise.resolve({ data: [], error: null }),
      canReadAllRegistrations ? privateOrderDb.from("ticket_orders").select("ticket_order_items(ticket_type_id,quantity)").eq("event_id", event.id).in("status", ["pending", "processing"]).gt("expires_at", new Date().toISOString()) : Promise.resolve({ data: [], error: null }),
    ]);

    [speakersRes, workshopsRes, partnersRes, ticketsRes, regsRes, attendeesRes, openOrdersRes].forEach(assertDatabaseResult);
    const registrations = regsRes.data ?? [];
    const issuedAttendees = attendeesRes.data ?? [];
    const openOrderItems = (openOrdersRes.data ?? []).flatMap((row) => row.ticket_order_items ?? []);
    const openQuantity = openOrderItems.reduce((sum, item) => sum + Number(item.quantity), 0);
    const entitlements = await getUserEntitlements(user?.userId);
    const membership = await getCurrentMembership(user?.userId);

    const tickets: EventTicketOption[] = (ticketsRes.data ?? []).map((ticket) => {
      const taken = registrations.filter((r) => r.ticket_type_id === ticket.id).length
        + issuedAttendees.filter((a) => a.ticket_type_id === ticket.id).length
        + openOrderItems.filter((item) => item.ticket_type_id === ticket.id).reduce((sum, item) => sum + Number(item.quantity), 0);
      const spotsLeft = !canReadAllRegistrations || ticket.capacity === null ? null : Math.max(ticket.capacity - taken, 0);
      const regularPrice = calculateTicketPrice(
        { basePrice:Number(ticket.base_price),currency:ticket.currency,requiredEntitlement:ticket.required_entitlement,
          discountEntitlement:ticket.discount_entitlement,freeEntitlement:ticket.free_entitlement },entitlements);
      const memberPrice=membership && ticket.member_price !== null && ticket.member_price !== undefined && regularPrice.eligible
        ? {...regularPrice,basePrice:Number(ticket.base_price),discount:Number(ticket.base_price)-Number(ticket.member_price),
            finalPrice:Number(ticket.member_price),reason:"Member ticket price",includedInMembership:Number(ticket.member_price)===0}
        : regularPrice;
      return {
        id: ticket.id,
        name: ticket.name,
        description: ticket.description,
        memberPrice: ticket.member_price === null || ticket.member_price === undefined ? null : Number(ticket.member_price),
        saleStart: ticket.sale_start,
        saleEnd: ticket.sale_end,
        price: memberPrice,
        spotsLeft,
        soldOut: event.event_status === "sold_out" || (spotsLeft !== null && spotsLeft === 0),
        hasMemberPricing: (ticket.member_price !== null && ticket.member_price !== undefined) || !!(ticket.required_entitlement || ticket.discount_entitlement || ticket.free_entitlement),
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
        registrationStart: event.registration_start,
        registrationEnd: event.registration_end,
        publishState: event.publish_state,
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
      isPreview: isAdminViewer && (!!data.preview || event.publish_state !== "published"),
      registrationOpen: isRegistrationOpen({
        status: event.event_status,
        registrationStart: event.registration_start,
        registrationEnd: event.registration_end,
      }),
      spotsLeft: !canReadAllRegistrations || event.capacity === null ? null : Math.max(event.capacity - registrations.length - issuedAttendees.length - openQuantity, 0),
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

/** Client submits ticket IDs and quantities only. Prices and entitlements are calculated server-side. */
export const startTicketCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => checkoutSchema.parse(data))
  .handler(async ({ data }) => {
    const { getOptionalUser } = await import("./auth.server");
    const user = await getOptionalUser();
    if (!user && (!data.buyerName || !data.buyerEmail)) throw new Error("Enter your name and email to continue as a guest.");
    const { startTicketOrder } = await import("./ticket-orders.server");
    return startTicketOrder({ userId: user?.userId ?? null,
      lines: data.lines.map((line) => ({ ticketId: line.ticketTypeId, quantity: line.quantity })),
      ...(data.buyerName ? { buyerName: data.buyerName } : {}),
      ...(data.buyerEmail ? { buyerEmail: data.buyerEmail } : {}),
    });
  });
