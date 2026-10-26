import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { earliestTicketSaleStart, eventScheduleIssue } from "./event-admin";
import { managedEventMediaPath } from "./event-media-rules";
import type { StaffPermission } from "./staff-permissions";
import { membershipBenefitValueIssue } from "./membership-benefit-rules";

const idSchema = z.object({ id: z.string().uuid() });

async function admin(permission: StaffPermission = "roles.manage") {
  const { requireStaffPermission } = await import("./auth.server");
  const actor = await requireStaffPermission(permission);
  if (actor.staffRoles.includes("admin")) {
    return (await import("./database.server")).getReadClient();
  }
  // Staff access is mediated by scoped server handlers; existing direct Data
  // API policies stay Admin-only. Never broaden is_admin() to include staff.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function loadEventMetrics(eventIds: string[]) {
  try {
    const { getAdminEventMetrics } = await import("./event-admin-metrics.server");
    return await getAdminEventMetrics(eventIds);
  } catch (error) {
    console.error(
      "[event admin] Sales and order metrics are unavailable:",
      error instanceof Error ? error.message : "Unexpected metrics error",
    );
    return null;
  }
}

/* ---------------------------------- dashboard --------------------------------- */

export const getAdminDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const [events, registrations, members, articles, partners, speakers, contacts, payments, content] = await Promise.all([
    db.from("events").select("id", { count: "exact", head: true }),
    db.from("registrations").select("id", { count: "exact", head: true }),
    db.from("memberships").select("id", { count: "exact", head: true }).eq("status", "active"),
    db.from("articles").select("id", { count: "exact", head: true }),
    db.from("partners").select("id", { count: "exact", head: true }),
    db.from("speakers").select("id", { count: "exact", head: true }),
    db.from("contacts").select("id", { count: "exact", head: true }),
    db.from("payments").select("id", { count: "exact", head: true }),
    db.from("content_entries").select("id", { count: "exact", head: true }),
  ]);
  return {
    events: events.count ?? 0,
    registrations: registrations.count ?? 0,
    activeMembers: members.count ?? 0,
    articles: articles.count ?? 0,
    partners: partners.count ?? 0,
    speakers: speakers.count ?? 0,
    contacts: contacts.count ?? 0,
    payments: payments.count ?? 0,
    content: content.count ?? 0,
  };
});

/* ----------------------------------- events ----------------------------------- */

const eventSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(2).max(200),
  title_en: z.string().max(200).nullable().default(null),
  event_type: z.enum(["regular_event", "symposium", "potlach", "workshop"]).default("regular_event"),
  slug: z
    .string()
    .min(2)
    .max(200)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes only"),
  short_description: z.string().max(400).nullable().default(null),
  short_description_en: z.string().max(400).nullable().default(null),
  description: z.string().max(20000).nullable().default(null),
  description_en: z.string().max(20000).nullable().default(null),
  hero_image_url: z.union([z.string().url(), z.string().regex(/^\/assets\/cometx\/[a-z0-9._-]+\.(?:jpg|jpeg|png|webp)$/i)]).nullable().default(null),
  gallery_urls: z.array(z.union([z.string().url(), z.string().regex(/^\/assets\/cometx\/[a-z0-9._-]+\.(?:jpg|jpeg|png|webp)$/i)])).default([]),
  start_date: z.string().min(1),
  end_date: z.string().nullable().default(null),
  venue: z.string().max(200).nullable().default(null),
  venue_en: z.string().max(200).nullable().default(null),
  address: z.string().max(300).nullable().default(null),
  address_en: z.string().max(300).nullable().default(null),
  capacity: z.number().int().positive().nullable().default(null),
  registration_start: z.string().nullable().default(null),
  registration_end: z.string().nullable().default(null),
  publish_state: z.enum(["draft", "published", "unpublished"]),
  event_status: z.enum([
    "upcoming",
    "registration_open",
    "registration_closed",
    "sold_out",
    "completed",
    "cancelled",
  ]),
  featured: z.boolean().default(false),
});

export const adminListEvents = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin("events.read");
  const { data, error } = await db
    .from("events")
    .select("id,title,slug,event_type,publish_state,event_status,start_date,end_date,venue,address,capacity,featured,hero_image_url,short_description,description,registration_start,registration_end,updated_at")
    .order("start_date", { ascending: false });
  if (error) throw new Error(error.message);
  const events = data ?? [];
  const metrics = await loadEventMetrics(events.map((event) => event.id));
  return events.map((event) => ({ ...event, metrics: metrics?.[event.id] ?? null }));
});

export const adminGetEvent = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin("events.read");
    const [eventResult, ticketsResult, speakersResult, workshopsResult] = await Promise.all([
      db.from("events").select("*").eq("id", data.id).maybeSingle(),
      db.from("ticket_types").select("*").eq("event_id", data.id).eq("active", true).order("sort_order"),
      db.from("event_speakers").select("speaker_id").eq("event_id", data.id),
      db.from("workshops").select("*").eq("event_id", data.id).order("start_time"),
    ]);
    for (const result of [eventResult, ticketsResult, speakersResult, workshopsResult]) {
      if (result.error) throw new Error(result.error.message);
    }
    const event = eventResult.data;
    if (!event) return null;
    const metrics = await loadEventMetrics([event.id]);
    return {
      event,
      tickets: ticketsResult.data ?? [],
      speakerIds: (speakersResult.data ?? []).map((s) => s.speaker_id),
      workshops: workshopsResult.data ?? [],
      metrics: metrics?.[event.id] ?? null,
    };
  });

export const adminSetEventPublishState = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), publishState: z.enum(["published", "unpublished"]) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin("events.write");
    const { data: event, error } = await db.from("events").update({ publish_state: data.publishState }).eq("id", data.id).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!event) throw new Error("This event could not be updated.");
    return { ok: true };
  });

export const adminSaveEvent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        event: eventSchema,
        speakerIds: z.array(z.string().uuid()).default([]),
        newSpeakers: z.array(z.object({
          name: z.string().trim().min(2).max(160),
          job_title: z.string().max(160).nullable().default(null),
          job_title_en: z.string().max(160).nullable().default(null),
          company: z.string().max(160).nullable().default(null),
          bio: z.string().max(4000).nullable().default(null),
          bio_en: z.string().max(4000).nullable().default(null),
          photo_url: z.string().url().nullable().default(null),
        })).max(30).default([]),
        tickets: z
        .array(
            z.object({
              id: z.string().uuid().optional(),
              name: z.string().min(1).max(160),
              name_en: z.string().max(160).nullable().default(null),
              description: z.string().max(500).nullable().default(null),
              description_en: z.string().max(500).nullable().default(null),
              base_price: z.number().min(0),
              member_price: z.number().min(0).nullable().default(null),
              sale_start: z.string().datetime().nullable().default(null),
              sale_end: z.string().datetime().nullable().default(null),
              currency: z.enum(["CHF","EUR","USD","GBP","CZK"]).default("CHF"),
              capacity: z.number().int().positive().nullable().default(null),
              required_entitlement: z.string().nullable().default(null),
              discount_entitlement: z.string().nullable().default(null),
              free_entitlement: z.string().nullable().default(null),
            }).refine(t => t.member_price === null || t.member_price <= t.base_price, "Member price cannot exceed public price")
              .refine(t => !t.sale_start || !t.sale_end || Date.parse(t.sale_end)>Date.parse(t.sale_start), "Sale end must follow sale start"),
          )
          .default([]),
        workshops: z.array(z.object({
          id: z.string().uuid().optional(),
          title: z.string().min(1).max(240),
          title_en: z.string().max(240).nullable().default(null),
          description: z.string().max(5000).nullable().default(null),
          description_en: z.string().max(5000).nullable().default(null),
          speaker_id: z.string().uuid().nullable().default(null),
          start_time: z.string().nullable().default(null),
          end_time: z.string().nullable().default(null),
          location: z.string().max(240).nullable().default(null),
          location_en: z.string().max(240).nullable().default(null),
          capacity: z.number().int().positive().nullable().default(null),
          base_price: z.number().min(0).default(0),
          separate_registration_required: z.boolean().default(false),
        })).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin("events.write");
    const { id, ...fields } = data.event;
    const firstTicket = earliestTicketSaleStart(data.tickets);
    if (firstTicket?.sale_start) fields.registration_start = firstTicket.sale_start;
    const scheduleIssue = eventScheduleIssue(fields);
    if (scheduleIssue) throw new Error(scheduleIssue);

    const { assertDatabaseResult } = await import("./database.server");
    if (data.speakerIds.length) {
      const allowedSpeakers = await db.from("speakers").select("id,event_id").in("id", data.speakerIds);
      assertDatabaseResult(allowedSpeakers);
      if (allowedSpeakers.data?.length !== new Set(data.speakerIds).size ||
        allowedSpeakers.data.some((speaker: { event_id: string | null }) => speaker.event_id && speaker.event_id !== (id ?? null))) {
        throw new Error("A selected speaker belongs to another event.");
      }
    }

    const { data: saved, error } = id
      ? await db.from("events").update(fields).eq("id", id).select("id,slug").single()
      : await db.from("events").insert(fields).select("id,slug").single();

    if (error) {
      if (error.code === "23505") throw new Error("An event with that slug already exists.");
      throw new Error(error.message);
    }

    const ticketLookup = await db.from("ticket_types").select("id").eq("event_id", saved.id);
    assertDatabaseResult(ticketLookup);
    const existingTickets = ticketLookup.data;
    const submittedTicketIds = new Set(data.tickets.flatMap((ticket) => ticket.id ? [ticket.id] : []));
    for (const ticket of existingTickets ?? []) {
      if (!submittedTicketIds.has(ticket.id)) {
        assertDatabaseResult(await db.from("ticket_types").update({ active: false }).eq("id", ticket.id));
      }
    }
    for (const [index, ticket] of data.tickets.entries()) {
      const { id: ticketId, ...ticketFields } = ticket;
      const payload = { ...ticketFields, event_id: saved.id, sort_order: index, active: true };
      if (ticketId) assertDatabaseResult(await db.from("ticket_types").update(payload).eq("id", ticketId).eq("event_id", saved.id));
      else assertDatabaseResult(await db.from("ticket_types").insert(payload));
    }

    const workshopLookup = await db.from("workshops").select("id").eq("event_id", saved.id);
    assertDatabaseResult(workshopLookup);
    const existingWorkshops = workshopLookup.data;
    const submittedWorkshopIds = new Set(data.workshops.flatMap((workshop) => workshop.id ? [workshop.id] : []));
    for (const workshop of existingWorkshops ?? []) {
      if (!submittedWorkshopIds.has(workshop.id)) {
        assertDatabaseResult(await db.from("workshops").delete().eq("id", workshop.id));
      }
    }
    for (const workshop of data.workshops) {
      const { id: workshopId, ...workshopFields } = workshop;
      const payload = { ...workshopFields, event_id: saved.id };
      if (workshopId) assertDatabaseResult(await db.from("workshops").update(payload).eq("id", workshopId).eq("event_id", saved.id));
      else assertDatabaseResult(await db.from("workshops").insert(payload));
    }

    // Create event-owned profiles only at the end of the event save. If their
    // event link fails, remove the new rows so no detached speaker records remain.
    const newSpeakerIds: string[] = [];
    if (data.newSpeakers.length) {
      const speakerRows = data.newSpeakers.map((draft: { name: string; job_title: string | null; job_title_en: string | null; company: string | null; bio: string | null; bio_en: string | null; photo_url: string | null }) => {
        const slugStem = draft.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "speaker";
        return { ...draft, event_id: saved.id, slug: `${slugStem.slice(0, 140)}-${crypto.randomUUID().slice(0, 8)}` };
      });
      const { data: createdSpeakers, error: speakerError } = await db.from("speakers").insert(speakerRows).select("id");
      if (speakerError) throw new Error(speakerError.message);
      newSpeakerIds.push(...(createdSpeakers ?? []).map((speaker: { id: string }) => speaker.id));
    }
    const selectedSpeakerIds = [...new Set([...data.speakerIds, ...newSpeakerIds])];
    const existingSpeakerLinks = await db.from("event_speakers").select("speaker_id").eq("event_id", saved.id);
    if (existingSpeakerLinks.error) {
      if (newSpeakerIds.length) await db.from("speakers").delete().eq("event_id", saved.id).in("id", newSpeakerIds);
      throw new Error("Existing event speakers could not be loaded. No new speaker was attached.");
    }
    if (selectedSpeakerIds.length) {
      const links = await db.from("event_speakers").upsert(
        selectedSpeakerIds.map((sid, i) => ({ event_id: saved.id, speaker_id: sid, sort_order: i })),
        { onConflict: "event_id,speaker_id" },
      );
      if (links.error) {
        if (newSpeakerIds.length) await db.from("speakers").delete().eq("event_id", saved.id).in("id", newSpeakerIds);
        throw new Error(links.error.message);
      }
    }
    const removedSpeakerIds = existingSpeakerLinks.data.map((link: { speaker_id: string }) => link.speaker_id).filter((speakerId: string) => !selectedSpeakerIds.includes(speakerId));
    if (removedSpeakerIds.length) {
      const removed = await db.from("event_speakers").delete().eq("event_id", saved.id).in("speaker_id", removedSpeakerIds);
      if (removed.error) throw new Error("The event was saved, but removed speaker links could not be updated. Please save again.");
    }

    const updatedTickets = await db.from("ticket_types").select("id,sort_order").eq("event_id",saved.id).eq("active",true).order("sort_order");
    assertDatabaseResult(updatedTickets);
    return { id: saved.id, slug: saved.slug, newSpeakerIds, ticketIds:(updatedTickets.data ?? []).map(t=>t.id) };
  });

export const adminDeleteEvent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin("events.write");
    const { count, error: registrationsError } = await db
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", data.id);
    if (registrationsError) throw new Error(registrationsError.message);
    if ((count ?? 0) > 0)
      throw new Error("Events with registrations cannot be deleted. Unpublish or cancel the event instead.");
    const linkedOrders = await db.from("ticket_order_items")
      .select("order_id,ticket_orders(status)")
      .eq("event_id", data.id)
      .limit(1);
    if (linkedOrders.error) throw new Error("Could not verify this event's orders. Please try again.");
    if (linkedOrders.data?.length) {
      const order = linkedOrders.data[0].ticket_orders;
      const status = Array.isArray(order) ? order[0]?.status : order?.status;
      if (status === "pending" || status === "processing") {
        throw new Error("An unpaid checkout is still open for this event. Cancel or expire that checkout before deleting the event.");
      }
      throw new Error("This event has order history. Paid or issued tickets cannot be deleted; contact support to review unpaid records.");
    }
    const { error } = await db.from("events").delete().eq("id", data.id);
    if (error?.code === "23503") throw new Error("This event has checkout or ticket records that must be reviewed before it can be deleted.");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------------------- event media -------------------------------- */

const eventMediaBucket = "cometx-event-media";
const eventMediaScope = z.enum(["event-heroes", "event-gallery", "speaker-photos"]);
const eventMediaPath = z.string().regex(managedEventMediaPath);

export const adminListEventMedia = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ scope: eventMediaScope, offset: z.number().int().min(0).default(0) }).parse(d))
  .handler(async ({ data: input }: { data: { scope: z.infer<typeof eventMediaScope>; offset: number } }) => {
    await admin("events.read");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.storage.from(eventMediaBucket).list(input.scope, {
      limit: 100,
      offset: input.offset,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (error) throw new Error("Event photos could not be loaded.");
    return (data ?? []).filter((file: { id?: string | null; name: string }) => file.id && /\.(?:jpg|png|webp)$/i.test(file.name)).map((file: { name: string; created_at: string }) => {
      const path = `${input.scope}/${file.name}`;
      return { path, url: supabaseAdmin.storage.from(eventMediaBucket).getPublicUrl(path).data.publicUrl, createdAt: file.created_at };
    });
  });

export const adminDeleteUnusedEventMedia = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ path: eventMediaPath }).parse(d))
  .handler(async ({ data: input }: { data: { path: string } }) => {
    await admin("events.write");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bucket = supabaseAdmin.storage.from(eventMediaBucket);
    const url = bucket.getPublicUrl(input.path).data.publicUrl;
    const [hero, gallery, speaker] = await Promise.all([
      supabaseAdmin.from("events").select("id", { count: "exact", head: true }).eq("hero_image_url", url),
      supabaseAdmin.from("events").select("id", { count: "exact", head: true }).contains("gallery_urls", [url]),
      supabaseAdmin.from("speakers").select("id", { count: "exact", head: true }).eq("photo_url", url),
    ]);
    if (hero.error || gallery.error || speaker.error) throw new Error("Photo references could not be verified. Nothing was deleted.");
    if ((hero.count ?? 0) + (gallery.count ?? 0) + (speaker.count ?? 0) > 0) {
      throw new Error("This photo is still used by an event or speaker. Remove the reference and save first.");
    }
    const { error } = await bucket.remove([input.path]);
    if (error) throw new Error("The unused photo could not be deleted.");
    return { ok: true };
  });

/* ---------------------------------- speakers ---------------------------------- */

const speakerSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(160),
  slug: z
    .string()
    .min(2)
    .max(160)
    .regex(/^[a-z0-9-]+$/),
  job_title: z.string().max(160).nullable().default(null),
  job_title_en: z.string().max(160).nullable().default(null),
  company: z.string().max(160).nullable().default(null),
  bio: z.string().max(4000).nullable().default(null),
  bio_en: z.string().max(4000).nullable().default(null),
  photo_url: z.string().url().nullable().default(null),
  linkedin_url: z.string().url().nullable().default(null),
  website_url: z.string().url().nullable().default(null),
});

export const adminListSpeakers = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ eventId: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data: input }: { data: { eventId?: string | undefined } }) => {
  const db = await admin("events.read");
  const query = db.from("speakers").select("*").order("name");
  const { data, error } = await (input.eventId ? query.or(`event_id.is.null,event_id.eq.${input.eventId}`) : query.is("event_id", null));
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const adminSaveSpeaker = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => speakerSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin("events.write");
    const { id, ...fields } = data;
    const { data: saved, error } = id
      ? await db.from("speakers").update(fields).eq("id", id).is("event_id", null).select("id").single()
      : await db.from("speakers").insert(fields).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: saved.id };
  });

export const adminDeleteSpeaker = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin("events.write");
    const { error } = await db.from("speakers").delete().eq("id", data.id).is("event_id", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateEventSpeaker = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    eventId: z.string().uuid(),
    speakerId: z.string().uuid(),
    name: z.string().trim().min(2).max(160),
    job_title: z.string().max(160).nullable(),
    job_title_en: z.string().max(160).nullable(),
    company: z.string().max(160).nullable(),
    bio: z.string().max(4000).nullable(),
    bio_en: z.string().max(4000).nullable(),
    photo_url: z.string().url().nullable(),
  }).parse(d))
  .handler(async ({ data: input }: { data: { eventId: string; speakerId: string; name: string; job_title: string | null; job_title_en: string | null; company: string | null; bio: string | null; bio_en: string | null; photo_url: string | null } }) => {
    const db = await admin("events.write");
    const { eventId, speakerId, ...fields } = input;
    const { data, error } = await db.from("speakers").update(fields)
      .eq("id", speakerId).eq("event_id", eventId).select("id").single();
    if (error || !data) throw new Error("This one-off speaker could not be updated for the event.");
    return { ok: true };
  });

export const adminDeleteEventSpeaker = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ eventId: z.string().uuid(), speakerId: z.string().uuid() }).parse(d))
  .handler(async ({ data: input }: { data: { eventId: string; speakerId: string } }) => {
    const db = await admin("events.write");
    const workshop = await db.from("workshops").select("id", { count: "exact", head: true })
      .eq("event_id", input.eventId).eq("speaker_id", input.speakerId);
    if (workshop.error) throw new Error("The speaker's programme links could not be checked.");
    if ((workshop.count ?? 0) > 0) throw new Error("Remove this speaker from the event's workshops and save before deleting them.");
    const { data, error } = await db.from("speakers").delete()
      .eq("id", input.speakerId).eq("event_id", input.eventId).select("id").single();
    if (error || !data) throw new Error("This one-off speaker could not be deleted.");
    return { ok: true };
  });

/* ---------------------------------- articles ---------------------------------- */

const articleSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(2).max(240),
  title_en: z.string().max(240).nullable().default(null),
  slug: z
    .string()
    .min(2)
    .max(240)
    .regex(/^[a-z0-9-]+$/),
  excerpt: z.string().max(600).nullable().default(null),
  excerpt_en: z.string().max(600).nullable().default(null),
  body: z.string().max(60000).nullable().default(null),
  body_en: z.string().max(60000).nullable().default(null),
  hero_image_url: z.string().url().nullable().default(null),
  status: z.enum(["draft", "published"]),
  visibility: z.enum(["public", "registered", "members", "entitlement"]),
  required_entitlement: z.string().nullable().default(null),
  published_at: z.string().nullable().default(null),
});

export const adminListArticles = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin("content.read");
  const { data } = await db
    .from("articles")
    .select("id,title,slug,status,visibility,published_at")
    .order("created_at", { ascending: false });
  return data ?? [];
});

export const adminGetArticle = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin("content.read");
    const { data: article } = await db.from("articles").select("*").eq("id", data.id).maybeSingle();
    return article;
  });

export const adminSaveArticle = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => articleSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin("content.write");
    const { id, ...fields } = data;
    const payload = {
      ...fields,
      published_at:
        fields.status === "published" ? (fields.published_at ?? new Date().toISOString()) : null,
    };
    const { error } = id
      ? await db.from("articles").update(payload).eq("id", id)
      : await db.from("articles").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteArticle = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin("content.write");
    const { error } = await db.from("articles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------- membership plans ------------------------------ */

export const adminListPlans = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin("memberships.read");
  const { data } = await db
    .from("membership_plans")
    .select("*, plan_entitlements(value, entitlements(id,key,name,description))")
    .order("sort_order");
  return data ?? [];
});

const entitlementDefinitionSchema = z.object({
  key: z.string().min(2).max(100).regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).nullable().default(null),
});

/** Stable keys are referenced by tickets/articles; admins may edit wording, never the key. */
export const adminUpdateEntitlementDefinition = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => entitlementDefinitionSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin("memberships.write");
    const { data: saved, error } = await db.from("entitlements").update({
      name: data.name,
      description: data.description,
    }).eq("key", data.key).select("key").maybeSingle();
    if (error || !saved) throw new Error("Benefit details could not be saved.");
    return { ok: true };
  });

export const adminCreateEntitlement = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => entitlementDefinitionSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin("memberships.write");
    const { error } = await db.from("entitlements").insert({
      key: data.key,
      name: data.name,
      description: data.description,
    });
    if (error?.code === "23505") throw new Error("That benefit key already exists. Choose another key.");
    if (error) throw new Error("Benefit could not be created.");
    return { ok: true };
  });

const planEntitlementSchema = z.object({
  planId: z.string().uuid(),
  entitlementKey: z.string().min(2).max(100).regex(/^[a-z][a-z0-9_]*$/),
  enabled: z.boolean(),
  value: z.number().min(0).max(100000).nullable(),
});

/**
 * Store a single plan/benefit mapping at a time. Keep numeric rules aligned with
 * quote_cometx_ticket; editing an active mapping takes effect on future checkouts.
 */
export const adminSetPlanEntitlement = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => planEntitlementSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin("memberships.write");
    const [{ data: plan, error: planError }, { data: entitlement, error: entitlementError }] = await Promise.all([
      db.from("membership_plans").select("id,slug").eq("id", data.planId).maybeSingle(),
      db.from("entitlements").select("id").eq("key", data.entitlementKey).maybeSingle(),
    ]);
    if (planError || entitlementError) throw new Error("Membership benefit could not be checked.");
    if (!plan || !entitlement) throw new Error("Choose an existing membership plan and benefit.");

    if (data.enabled) {
      const valueIssue = membershipBenefitValueIssue(data.entitlementKey, plan.slug, data.value);
      if (valueIssue) throw new Error(valueIssue);
      const { error } = await db.from("plan_entitlements").upsert({
        membership_plan_id: plan.id,
        entitlement_id: entitlement.id,
        value: data.value,
      }, { onConflict: "membership_plan_id,entitlement_id" });
      if (error) throw new Error("Benefit assignment could not be saved.");
    } else {
      const { error } = await db.from("plan_entitlements").delete()
        .eq("membership_plan_id", plan.id)
        .eq("entitlement_id", entitlement.id);
      if (error) throw new Error("Benefit could not be removed from this plan.");
    }
    return { ok: true };
  });

export const adminSyncMembershipCatalog = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({}).parse(d))
  .handler(async () => {
    const db = await admin("memberships.write");
    const { data: plans, error } = await db.from("membership_plans").select("id");
    if (error) throw new Error("Membership plans could not be loaded.");
    const { syncMembershipProduct } = await import("./membership-payments.server");
    let synced = 0;
    let failed = 0;
    for (const plan of plans ?? []) {
      try {
        if (await syncMembershipProduct(plan.id)) synced += 1;
        else failed += 1;
      } catch (syncError) {
        failed += 1;
        console.error("[membership-catalogue] sync failed", { planId: plan.id, syncError });
      }
    }
    return { processed: plans?.length ?? 0, synced, failed };
  });

export const adminSavePlan = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(2).max(120),
        name_en: z.string().max(120).nullable().default(null),
        slug: z
          .string()
          .min(2)
          .max(120)
          .regex(/^[a-z0-9-]+$/),
        description: z.string().max(1000).nullable().default(null),
        description_en: z.string().max(1000).nullable().default(null),
        annual_price: z.number().min(0),
        currency: z.string().length(3).default("CHF"),
        active: z.boolean().default(true),
        sort_order: z.number().int().default(0),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin("memberships.write");
    const { id, ...fields } = data;
    const recurringFields = { ...fields, billing_interval: "year", setup_fee: 1.99 };
    const result = id
      ? await db.from("membership_plans").update(recurringFields).eq("id", id).select("id").single()
      : await db.from("membership_plans").insert(recurringFields).select("id").single();
    const { error } = result;
    if (error) throw new Error(error.message);
    let paymentSyncReady = false;
    try {
      const { syncMembershipProduct } = await import("./membership-payments.server");
      paymentSyncReady = await syncMembershipProduct(result.data.id);
    } catch (syncError) {
      console.error("[membership-catalogue] plan saved but product sync failed", { planId: result.data.id, syncError });
    }
    return { ok: true, paymentSyncReady };
  });

/* -------------------------- registrations & members --------------------------- */

export const adminListRegistrations = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin("attendees.read");
  const { data } = await db
    .from("registrations")
    .select("id,user_id,status,price_paid,currency,created_at,events(title,slug),ticket_types(name)")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = data ?? [];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles } = userIds.length
    ? await db.from("profiles").select("id,first_name,last_name,email").in("id", userIds)
    : { data: [] };

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return rows.map((row) => ({
    ...row,
    attendeeName:
      [byId.get(row.user_id)?.first_name, byId.get(row.user_id)?.last_name]
        .filter(Boolean)
        .join(" ") || "Unknown",
    attendeeEmail: byId.get(row.user_id)?.email ?? null,
  }));
});

export const adminListMembers = createServerFn({ method: "GET" }).handler(async () => {
  const startedAt = performance.now();
  const db = await admin("members.read");
  const authorizedAt = performance.now();
  const { data: profiles, error: profilesError } = await db
    .from("profiles")
    .select("id,first_name,last_name,email,company,country,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (profilesError) throw new Error(profilesError.message);
  const profilesLoadedAt = performance.now();

  const userIds = ((profiles ?? []) as { id: string }[]).map((profile) => profile.id);
  if (!userIds.length) return [];
  const now = new Date().toISOString();
  const [{ data: memberships, error: membershipsError }, { data: roles, error: rolesError }] = await Promise.all([
    db.from("memberships")
      .select("user_id,status,ends_at,membership_plans(name)")
      .in("user_id", userIds)
      .eq("status", "active")
      .lte("starts_at", now)
      .or(`ends_at.is.null,ends_at.gt.${now}`)
      .order("starts_at", { ascending: false }),
    db.from("user_roles").select("user_id,role").in("user_id", userIds),
  ]);
  if (membershipsError) throw new Error(membershipsError.message);
  if (rolesError) throw new Error(rolesError.message);
  const relatedLoadedAt = performance.now();
  if (relatedLoadedAt - startedAt > 1000) {
    console.info("[admin latency] members", {
      authorizationMs: Math.round(authorizedAt - startedAt),
      profilesMs: Math.round(profilesLoadedAt - authorizedAt),
      relatedMs: Math.round(relatedLoadedAt - profilesLoadedAt),
    });
  }

  type MemberProfile = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    company: string | null;
    country: string | null;
    created_at: string;
  };
  type MemberMembership = {
    user_id: string;
    status: string;
    membership_plans: { name: string } | { name: string }[] | null;
  };
  type MemberRole = { user_id: string; role: string };
  const memberProfiles = (profiles ?? []) as MemberProfile[];
  const memberRows = (memberships ?? []) as MemberMembership[];
  const roleRows = (roles ?? []) as MemberRole[];
  const byUser = new Map<string, MemberMembership>();
  for (const membership of memberRows) {
    if (!byUser.has(membership.user_id)) byUser.set(membership.user_id, membership);
  }
  const admins = new Set(
    roleRows.filter((role) => role.role === "admin").map((role) => role.user_id),
  );
  return memberProfiles.map((p) => {
    const plan = byUser.get(p.id)?.membership_plans;
    return {
      ...p,
      planName: Array.isArray(plan) ? (plan[0]?.name ?? null) : (plan?.name ?? null),
      membershipStatus: byUser.get(p.id)?.status ?? null,
      isAdmin: admins.has(p.id),
      staffRoles: roleRows.filter((role) => role.user_id === p.id).map((role) => role.role).filter((role) => ["admin", "event_manager", "data_analyst", "marketing"].includes(role)),
    };
  });
});

const memberRoleSchema = z.object({ id: z.string().uuid() });

export const adminGrantMemberAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => memberRoleSchema.parse(input))
  .handler(async ({ data }: { data: z.infer<typeof memberRoleSchema> }) => {
    await (await import("./auth.server")).requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as SupabaseClient;
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("id")
      .eq("id", data.id)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile) throw new Error("This member account could not be found.");

    const { data: existingRole, error: roleError } = await db
      .from("user_roles")
      .select("id")
      .eq("user_id", data.id)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) throw new Error(roleError.message);
    if (existingRole) return { ok: true, alreadyAdmin: true };

    const { error } = await db.from("user_roles").insert({ user_id: data.id, role: "admin" });
    if (error && error.code !== "23505") throw new Error(error.message);
    return { ok: true, alreadyAdmin: error?.code === "23505" };
  });

export const adminRevokeMemberAdmin = createServerFn({ method: "POST" })
  .validator((input: unknown) => memberRoleSchema.parse(input))
  .handler(async ({ data }: { data: z.infer<typeof memberRoleSchema> }) => {
    const actor = await (await import("./auth.server")).requireAdmin();
    if (data.id === actor.userId) {
      throw new Error("You cannot remove your own administrator access. Ask another administrator.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as SupabaseClient;
    // Remove only this privilege; keep all other roles, the account and its history.
    const { error } = await db
      .from("user_roles")
      .delete()
      .eq("user_id", data.id)
      .eq("role", "admin");
    if (error) throw new Error("Administrator access could not be removed. Please try again.");
    return { ok: true };
  });

export const adminDeleteMemberAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => memberRoleSchema.parse(input))
  .handler(async ({ data }: { data: z.infer<typeof memberRoleSchema> }) => {
    const actor = await (await import("./auth.server")).requireAdmin();
    if (data.id === actor.userId) {
      throw new Error("You cannot delete your own administrator account here.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as SupabaseClient;
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("id")
      .eq("id", data.id)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile) throw new Error("This member account could not be found.");

    const { data: adminRole, error: roleError } = await db
      .from("user_roles")
      .select("id")
      .eq("user_id", data.id)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) throw new Error(roleError.message);
    if (adminRole) throw new Error("Remove administrator access before deleting this account.");

    // Keep the auth identity whenever any business, attendee, membership, or payment
    // history exists. A query failure also blocks deletion (fail closed).
    const historyChecks = [
      [
        "memberships",
        () => db.from("memberships").select("id", { count: "exact", head: true }).eq("user_id", data.id),
      ],
      [
        "membership applications",
        () => db.from("membership_applications").select("id", { count: "exact", head: true }).eq("user_id", data.id),
      ],
      [
        "event registrations",
        () => db.from("registrations").select("id", { count: "exact", head: true }).eq("user_id", data.id),
      ],
      [
        "ticket orders",
        () => db.from("ticket_orders").select("id", { count: "exact", head: true }).eq("user_id", data.id),
      ],
      [
        "issued tickets",
        () => db.from("ticket_attendees").select("id", { count: "exact", head: true }).eq("user_id", data.id),
      ],
      [
        "checkout records",
        () => db.from("ticket_checkout_batches").select("id", { count: "exact", head: true }).eq("user_id", data.id),
      ],
      [
        "payments",
        () => db.from("payments").select("id", { count: "exact", head: true }).eq("user_id", data.id),
      ],
    ] as const;
    const history = await Promise.all(
      historyChecks.map(async ([label, check]) => ({ label, ...(await check()) })),
    );
    const failedCheck = history.find((item) => item.error);
    if (failedCheck?.error) {
      console.error("[admin member deletion] Could not verify account history", {
        table: failedCheck.label,
        error: failedCheck.error.message,
      });
      throw new Error(
        "Could not safely verify this account’s history. Nothing was deleted; please try again or contact support.",
      );
    }
    const linkedHistory = history
      .filter((item) => (item.count ?? 0) > 0)
      .map((item) => item.label);
    if (linkedHistory.length) {
      throw new Error(
        `This account has linked ${linkedHistory.join(", ")}. Deletion is blocked to preserve its history.`,
      );
    }

    const authAdmin = (supabaseAdmin.auth as unknown as {
      admin: { deleteUser(id: string): Promise<{ error: { message: string } | null }> };
    }).admin;
    const { error: deleteError } = await authAdmin.deleteUser(data.id);
    if (deleteError) throw new Error(`Account deletion failed: ${deleteError.message}`);
    return { ok: true };
  });

export const adminListPartners = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin("partners.read");
  const { data } = await db.from("partners").select("*").order("name");
  return data ?? [];
});

export const adminListWorkshops = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin("events.read");
  const { data } = await db
    .from("workshops")
    .select("id,title,start_time,location,base_price,events(title),speakers(name)")
    .order("start_time");
  return data ?? [];
});

export const adminListEntitlements = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin("entitlements.read");
  const { data, error } = await db.from("entitlements").select("key,name,description").order("key");
  if (error) throw new Error("Benefits could not be loaded.");
  return data ?? [];
});

export const adminListEventBenefitMatrix = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin("events.read");
  const { data, error } = await db
    .from("membership_plans")
    .select("id,name,slug,plan_entitlements(value,entitlements(key,name))")
    .eq("active", true)
    .order("sort_order");
  if (error) throw new Error("Membership benefits could not be loaded.");
  return data ?? [];
});

const partnerSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(200),
  tier: z.string().max(100).nullable().default(null),
  sector: z.string().max(120).nullable().default(null),
  collaboration_start_date: z.string().date().nullable().default(null),
  collaboration_end_date: z.string().date().nullable().default(null),
  website_url: z.string().url().nullable().default(null),
  logo_url: z.string().url().nullable().default(null),
  description: z.string().max(3000).nullable().default(null),
  description_en: z.string().max(3000).nullable().default(null),
  active: z.boolean().default(true),
}).refine(
  (partner) =>
    !partner.collaboration_start_date ||
    !partner.collaboration_end_date ||
    partner.collaboration_start_date <= partner.collaboration_end_date,
  { message: "The collaboration end date must be on or after the start date.", path: ["collaboration_end_date"] },
);

export const adminSavePartner = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => partnerSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin("partners.write");
    const { id, ...fields } = data;
    const { error } = id ? await db.from("partners").update(fields).eq("id", id) : await db.from("partners").insert(fields);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeletePartner = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin("partners.write");
    const { error } = await db.from("partners").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListMemberOptions = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin("contacts.read");
  const { data, error } = await db.from("profiles").select("id,first_name,last_name,email").order("email").limit(500);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getAdminIntegrationStatus = createServerFn({ method: "GET" }).handler(async () => {
  await admin("settings.manage");
  return ({
  resend: Boolean(process.env["RESEND_API_KEY"] && process.env["RESEND_FROM_EMAIL"]),
  stripe: Boolean(process.env["STRIPE_SECRET_KEY"]),
  stripeWebhook: Boolean(process.env["STRIPE_WEBHOOK_SECRET"]),
  gaMeasurementId: Boolean(process.env["VITE_GA_MEASUREMENT_ID"]),
  gtmContainerId: Boolean(process.env["VITE_GTM_CONTAINER_ID"]),
});
});

/* ---------------------- contacts, newsletter and payments --------------------- */

const contactSchema = z.object({
  id: z.string().uuid().optional(),
  email: z.string().email().max(320),
  first_name: z.string().max(120).nullable().default(null),
  last_name: z.string().max(120).nullable().default(null),
  phone: z.string().max(80).nullable().default(null),
  company: z.string().max(160).nullable().default(null),
  source: z.string().min(2).max(80).default("manual"),
  newsletter_status: z.enum(["subscribed", "unsubscribed", "pending"]),
  member_id: z.string().uuid().nullable().default(null),
  notes: z.string().max(5000).nullable().default(null),
});

export const adminListContacts = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ query: z.string().max(160).default(""), status: z.enum(["all", "subscribed", "unsubscribed", "pending"]).default("all") }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin("contacts.read");
    let request = db.from("contacts").select("*").order("created_at", { ascending: false }).limit(500);
    if (data.status !== "all") request = request.eq("newsletter_status", data.status);
    if (data.query.trim()) {
      const term = data.query.trim().replace(/[,%()]/g, "");
      request = request.or(`email.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,company.ilike.%${term}%`);
    }
    const { data: contacts, error } = await request;
    if (error) throw new Error(error.message);
    return contacts ?? [];
  });

export const adminSaveContact = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => contactSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin("contacts.write");
    const { id, ...fields } = data;
    const payload = {
      ...fields,
      email: fields.email.trim().toLowerCase(),
      ...(fields.newsletter_status === "subscribed" ? { consent_at: new Date().toISOString() } : {}),
    };
    const { error } = id ? await db.from("contacts").update(payload).eq("id", id) : await db.from("contacts").insert(payload);
    if (error) throw new Error(error.code === "23505" ? "A contact with this email already exists." : error.message);
    return { ok: true };
  });

export const adminListPayments = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin("payments.read");
  const { data, error } = await db.from("payments").select("id,user_id,registration_id,membership_id,amount,currency,status,invoice_url,receipt_url,created_at").order("created_at", { ascending: false }).limit(300);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const adminListTicketOrders = createServerFn({ method: "GET" }).handler(async () => {
  await admin("orders.read");
  const { listAdminTicketOrders } = await import("./ticket-orders.server");
  return listAdminTicketOrders();
});

const eventAttendeesInput = z.object({ eventId: z.string().uuid() });
const attendeeCheckInInput = z.object({ eventId: z.string().uuid(), attendeeId: z.string().uuid() });

export const adminListEventAttendees = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => eventAttendeesInput.parse(d))
  .handler(async ({ data }) => {
    await admin("attendees.read");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as SupabaseClient;
    const rows: unknown[] = [];
    const pageSize = 500;
    for (let from = 0; ; from += pageSize) {
      const { data: page, error } = await db.from("ticket_attendees")
        .select("id,event_id,order_id,order_item_id,ticket_type_id,attendee_name,attendee_email,ticket_code,status,created_at,checked_in_at,checked_in_by,ticket_orders!inner(id,buyer_name,buyer_email,buyer_kind,status),ticket_order_items!inner(ticket_name)")
        .eq("event_id", data.eventId)
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) throw new Error("Attendees could not be loaded. Please try again.");
      rows.push(...(page ?? []));
      if (!page || page.length < pageSize) break;
    }
    return JSON.parse(JSON.stringify(rows));
  });

export const adminCheckInEventAttendee = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => attendeeCheckInInput.parse(d))
  .handler(async ({ data }) => {
    const actor = await (await import("./auth.server")).requireStaffPermission("attendees.check_in");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as SupabaseClient;
    const { data: attendee, error } = await db.from("ticket_attendees")
      .select("id,status,ticket_orders!inner(status)")
      .eq("id", data.attendeeId)
      .eq("event_id", data.eventId)
      .maybeSingle();
    if (error || !attendee) throw new Error("This event ticket could not be found.");
    const attendeeRow = attendee as unknown as {
      status: string;
      ticket_orders: { status: string } | { status: string }[] | null;
    };
    const orderStatus = Array.isArray(attendeeRow.ticket_orders)
      ? attendeeRow.ticket_orders[0]?.status
      : attendeeRow.ticket_orders?.status;
    const { canCheckInEventTicket } = await import("./event-attendees");
    if (attendeeRow.status === "checked_in") return { ok: true, alreadyCheckedIn: true };
    if (!canCheckInEventTicket(attendeeRow.status, orderStatus ?? "")) {
      throw new Error("Only a valid ticket from a confirmed order can be checked in.");
    }

    const { data: checkedIn, error: updateError } = await db.from("ticket_attendees")
      .update({ status: "checked_in", checked_in_at: new Date().toISOString(), checked_in_by: actor.userId })
      .eq("id", data.attendeeId)
      .eq("event_id", data.eventId)
      .eq("status", "valid")
      .select("id")
      .maybeSingle();
    if (updateError) throw new Error("The ticket could not be checked in. Please try again.");
    if (!checkedIn) {
      const { data: current } = await db.from("ticket_attendees")
        .select("status").eq("id", data.attendeeId).eq("event_id", data.eventId).maybeSingle();
      if (current?.status === "checked_in") return { ok: true, alreadyCheckedIn: true };
      throw new Error("The ticket status changed. Refresh the attendee list and try again.");
    }
    return { ok: true, alreadyCheckedIn: false };
  });

/* ------------------------------ structured content ---------------------------- */

const contentSchema = z.object({
  id: z.string().uuid().optional(),
  content_type: z.enum(["video", "gallery", "opinion", "open_position", "symposium"]),
  title: z.string().min(2).max(240),
  title_en: z.string().max(240).nullable().default(null),
  slug: z.string().min(2).max(240).regex(/^[a-z0-9-]+$/),
  summary: z.string().max(600).nullable().default(null),
  summary_en: z.string().max(600).nullable().default(null),
  body: z.string().max(60000).nullable().default(null),
  body_en: z.string().max(60000).nullable().default(null),
  hero_image_url: z.string().url().nullable().default(null),
  media_urls: z.array(z.string().url()).default([]),
  status: z.enum(["draft", "published"]),
  published_at: z.string().nullable().default(null),
});

export const adminListContent = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin("content.read");
  const { data, error } = await db.from("content_entries").select("*").order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const adminSaveContent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => contentSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin("content.write");
    const { id, ...fields } = data;
    const payload = { ...fields, published_at: fields.status === "published" ? (fields.published_at ?? new Date().toISOString()) : null };
    const { error } = id ? await db.from("content_entries").update(payload).eq("id", id) : await db.from("content_entries").insert(payload);
    if (error) throw new Error(error.code === "23505" ? "Content with this slug already exists." : error.message);
    return { ok: true };
  });

export const adminDeleteContent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin("content.write");
    const { error } = await db.from("content_entries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
