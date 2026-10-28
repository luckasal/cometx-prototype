import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { earliestTicketSaleStart, eventScheduleIssue } from "./event-admin";
import { managedEventMediaPath } from "./event-media-rules";
import { hasStaffPermission, type StaffPermission } from "./staff-permissions";
import { membershipBenefitValueIssue } from "./membership-benefit-rules";
import { isCatalogBenefit } from "./membership-benefit-catalog";
import { normalizeContactEmail } from "./contact-import";

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
          client_id: z.string().uuid().optional(),
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
    const existingEventTickets = id
      ? await db.from("ticket_types")
        .select("id,required_entitlement,discount_entitlement,free_entitlement")
        .eq("event_id", id)
      : { data: [], error: null };
    if (existingEventTickets.error) throw new Error("Ticket entitlements could not be checked. Nothing was saved.");
    const existingTicketMap = new Map((existingEventTickets.data ?? []).map((ticket: {
      id: string;
      required_entitlement: string | null;
      discount_entitlement: string | null;
      free_entitlement: string | null;
    }) => [ticket.id, ticket]));
    await assertEntitlementReferencesAssignable(db, data.tickets.flatMap((ticket) =>
      (["required_entitlement", "discount_entitlement", "free_entitlement"] as const)
        .filter((field) => ticket[field])
        .map((field) => ({
          key: ticket[field]!,
          allowArchived: !!ticket.id && existingTicketMap.get(ticket.id)?.[field] === ticket[field],
        })),
    ));
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
    const workshopIds: string[] = [];
    const pendingWorkshopSpeakers: { workshopId: string; clientId: string }[] = [];
    for (const workshop of data.workshops) {
      const { id: workshopId, ...workshopFields } = workshop;
      const pendingSpeaker = data.newSpeakers.find((speaker) => speaker.client_id === workshopFields.speaker_id);
      const payload = { ...workshopFields, speaker_id: pendingSpeaker ? null : workshopFields.speaker_id, event_id: saved.id };
      const result = workshopId
        ? await db.from("workshops").update(payload).eq("id", workshopId).eq("event_id", saved.id).select("id").single()
        : await db.from("workshops").insert(payload).select("id").single();
      assertDatabaseResult(result);
      if (!result.data) throw new Error("Workshop could not be saved.");
      workshopIds.push(result.data.id);
      if (pendingSpeaker?.client_id) pendingWorkshopSpeakers.push({ workshopId: result.data.id, clientId: pendingSpeaker.client_id });
    }

    // Create event-owned profiles only at the end of the event save. If their
    // event link fails, remove the new rows so no detached speaker records remain.
    const newSpeakerIds: string[] = [];
    if (data.newSpeakers.length) {
      const speakerRows = data.newSpeakers.map((draft) => {
        const { client_id: _clientId, ...fields } = draft;
        const slugStem = draft.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "speaker";
        return { ...fields, event_id: saved.id, slug: `${slugStem.slice(0, 140)}-${crypto.randomUUID().slice(0, 8)}` };
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

    const newSpeakerIdByDraft = new Map(data.newSpeakers.map((speaker, index) => [speaker.client_id, newSpeakerIds[index]]));
    for (const pending of pendingWorkshopSpeakers) {
      const speakerId = newSpeakerIdByDraft.get(pending.clientId);
      if (!speakerId) throw new Error("The new workshop speaker could not be linked. Save the event again.");
      assertDatabaseResult(await db.from("workshops").update({ speaker_id: speakerId }).eq("id", pending.workshopId).eq("event_id", saved.id));
    }

    const updatedTickets = await db.from("ticket_types").select("id,sort_order").eq("event_id",saved.id).eq("active",true).order("sort_order");
    assertDatabaseResult(updatedTickets);
    return { id: saved.id, slug: saved.slug, newSpeakerIds, workshopIds, ticketIds:(updatedTickets.data ?? []).map(t=>t.id) };
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
    let hasOrders: boolean;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { readEventOrders } = await import("./event-orders.server");
      const orderCheck = await readEventOrders(supabaseAdmin, {
        eventId: data.id,
        search: "",
        status: "all",
        buyerKind: "all",
        page: 0,
      });
      hasOrders = orderCheck.total > 0;
    } catch {
      throw new Error("Could not verify this event's orders. Please try again.");
    }
    if (hasOrders)
      throw new Error("This event has checkout history and cannot be deleted. Unpublish or cancel the event instead.");
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
    if (data.visibility === "entitlement" && data.required_entitlement) {
      const existing = data.id
        ? await db.from("articles").select("required_entitlement").eq("id", data.id).maybeSingle()
        : { data: null, error: null };
      if (existing.error) throw new Error("Article entitlement could not be checked. Nothing was saved.");
      await assertEntitlementReferencesAssignable(db, [{
        key: data.required_entitlement,
        allowArchived: existing.data?.required_entitlement === data.required_entitlement,
      }]);
    }
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

type EntitlementReference = { key: string; allowArchived: boolean };

async function assertEntitlementReferencesAssignable(
  db: SupabaseClient,
  references: EntitlementReference[],
) {
  if (!references.length) return;
  const keys = [...new Set(references.map((reference) => reference.key))];
  const { data, error } = await db.from("entitlements").select("key,archived_at").in("key", keys);
  if (error || !data) throw new Error("Entitlement availability could not be checked. Nothing was saved.");
  const definitions = new Map(data.map((item: { key: string; archived_at: string | null }) => [item.key, item]));
  for (const reference of references) {
    const definition = definitions.get(reference.key);
    if (!definition) throw new Error("Choose an existing entitlement.");
    if (definition.archived_at && !reference.allowArchived)
      throw new Error("This entitlement is archived and cannot be assigned to new tickets or content. Restore it first.");
  }
}

export const adminSetEntitlementArchived = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ key: z.string().min(2).max(100), archived: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin("memberships.write");
    const { data: saved, error } = await db.from("entitlements").update({
      archived_at: data.archived ? new Date().toISOString() : null,
    }).eq("key", data.key).select("key,archived_at").maybeSingle();
    if (error || !saved) throw new Error("Entitlement archive status could not be saved.");
    return { ok: true, archived: !!saved.archived_at };
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

export const adminDeleteCustomEntitlement = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ key: z.string().min(2).max(100) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin("memberships.write");
    if (isCatalogBenefit(data.key)) throw new Error("Built-in membership benefits cannot be deleted.");
    const { data: entitlement, error: lookupError } = await db.from("entitlements")
      .select("id").eq("key", data.key).maybeSingle();
    if (lookupError || !entitlement) throw new Error("This benefit no longer exists. Refresh the page.");
    const [assignments, ticketAccess, ticketDiscounts, ticketFree, articles] = await Promise.all([
      db.from("plan_entitlements").select("id", { count: "exact", head: true }).eq("entitlement_id", entitlement.id),
      db.from("ticket_types").select("id", { count: "exact", head: true }).eq("required_entitlement", data.key),
      db.from("ticket_types").select("id", { count: "exact", head: true }).eq("discount_entitlement", data.key),
      db.from("ticket_types").select("id", { count: "exact", head: true }).eq("free_entitlement", data.key),
      db.from("articles").select("id", { count: "exact", head: true }).eq("required_entitlement", data.key),
    ]);
    if ([assignments, ticketAccess, ticketDiscounts, ticketFree, articles].some((result) => result.error))
      throw new Error("Benefit usage could not be checked. Nothing was deleted.");
    if (assignments.count) throw new Error("Remove this benefit from its membership plans before deleting it.");
    if (ticketAccess.count || ticketDiscounts.count || ticketFree.count || articles.count)
      throw new Error("This benefit is used by a ticket or article. Remove those references before deleting it.");
    const { data: deleted, error } = await db.from("entitlements").delete().eq("id", entitlement.id).select("id").maybeSingle();
    if (error?.code === "23503") throw new Error("This benefit is still in use. Refresh the page and remove its references first.");
    if (error || !deleted) throw new Error("Benefit could not be deleted.");
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
      db.from("entitlements").select("id,archived_at").eq("key", data.entitlementKey).maybeSingle(),
    ]);
    if (planError || entitlementError) throw new Error("Membership benefit could not be checked.");
    if (!plan || !entitlement) throw new Error("Choose an existing membership plan and benefit.");
    if (data.enabled && entitlement.archived_at)
      throw new Error("This entitlement is archived. Restore it before assigning it to a plan.");

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
  const { data, error } = await db.from("entitlements").select("key,name,description,archived_at").order("key");
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

type ContactDirectoryKind = "Contact record" | "Member account" | "Guest attendee" | "Partner organization" | "Speaker";
type ContactDirectoryEntry = {
  id: string;
  contact_id: string | null;
  member_id: string | null;
  types: ContactDirectoryKind[];
  sourceCounts: Partial<Record<ContactDirectoryKind, number>>;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  birth_year: number | null;
  newsletter_status: "subscribed" | "unsubscribed" | "pending" | null;
  notes: string | null;
  context: string[];
  created_at: string | null;
};
type GuestAttendeeDirectoryRow = {
  id: string;
  attendee_name: string;
  attendee_email: string;
  event_id: string;
  status: string;
  created_at: string;
};
type GuestAttendeeQueryClient = {
  from(table: "ticket_attendees"): {
    select(columns: string): {
      is(column: "user_id", value: null): {
        order(column: "created_at", options: { ascending: false }): {
          range(from: number, to: number): PromiseLike<{
            data: GuestAttendeeDirectoryRow[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
};

async function readAllAdminPages<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>,
) {
  const rows: T[] = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}

export const adminListContactDirectory = createServerFn({ method: "GET" }).handler(async () => {
  const { requireStaffPermission } = await import("./auth.server");
  const actor = await requireStaffPermission("contacts.read");
  const canRead = (permission: StaffPermission) => hasStaffPermission(actor.staffRoles, permission);
  const [contacts, profiles, attendees, partners, speakers] = await Promise.all([
    (async () => {
      const db = await admin("contacts.read");
      return readAllAdminPages(async (from, to) => db.from("contacts")
        .select("id,email,first_name,last_name,phone,company,linkedin_url,birth_year,notes,source,newsletter_status,member_id,archived_at,created_at")
        .order("created_at", { ascending: false }).range(from, to));
    })(),
    canRead("members.read") ? (async () => {
      const db = await admin("members.read");
      return readAllAdminPages(async (from, to) => db.from("profiles")
        .select("id,first_name,last_name,email,phone,company,created_at")
        .order("created_at", { ascending: false }).range(from, to));
    })() : Promise.resolve([]),
    canRead("attendees.read") ? (async () => {
      // ticket_attendees exists in Production but is missing from the generated
      // Supabase Database type; keep this cast scoped to this read-only query.
      await requireStaffPermission("attendees.read");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = supabaseAdmin as unknown as GuestAttendeeQueryClient;
      return readAllAdminPages<GuestAttendeeDirectoryRow>(async (from, to) => {
        const { data, error } = await db.from("ticket_attendees")
          .select("id,attendee_name,attendee_email,event_id,status,created_at")
          .is("user_id", null).order("created_at", { ascending: false }).range(from, to);
        return { data, error };
      });
    })() : Promise.resolve([]),
    canRead("partners.read") ? (async () => {
      const db = await admin("partners.read");
      return readAllAdminPages(async (from, to) => db.from("partners")
        .select("id,name,website_url,description,tier,active,created_at")
        .order("name").range(from, to));
    })() : Promise.resolve([]),
    canRead("events.read") ? (async () => {
      const db = await admin("events.read");
      return readAllAdminPages(async (from, to) => db.from("speakers")
        .select("id,name,job_title,company,linkedin_url,website_url,event_id,created_at")
        .order("name").range(from, to));
    })() : Promise.resolve([]),
  ]);

  const entries = new Map<string, ContactDirectoryEntry>();
  const groupsByEmail = new Map<string, Set<string>>();
  const memberGroupIds = new Map<string, string>();
  const normalizedEmail = (email: string | null | undefined) => normalizeContactEmail(email ?? "");
  const addEmailGroup = (email: string | null, id: string) => {
    const normalized = normalizedEmail(email);
    if (!normalized) return;
    const ids = groupsByEmail.get(normalized) ?? new Set<string>();
    ids.add(id);
    groupsByEmail.set(normalized, ids);
  };
  const emailGroup = (email: string | null, fallback: string) => {
    const normalized = normalizedEmail(email);
    const matches = normalized ? groupsByEmail.get(normalized) : undefined;
    if (matches?.size === 1) return [...matches][0]!;
    return normalized && matches?.size !== 1 ? `email:${normalized}` : fallback;
  };
  const addEntry = (id: string, kind: ContactDirectoryKind, values: Omit<ContactDirectoryEntry, "id" | "types" | "sourceCounts">) => {
    const existing = entries.get(id);
    if (!existing) {
      entries.set(id, { id, types: [kind], sourceCounts: { [kind]: 1 }, ...values });
      addEmailGroup(values.email, id);
      return;
    }
    if (!existing.types.includes(kind)) existing.types.push(kind);
    existing.contact_id ||= values.contact_id;
    existing.member_id ||= values.member_id;
    existing.sourceCounts[kind] = (existing.sourceCounts[kind] ?? 0) + 1;
    existing.name ||= values.name;
    existing.email ||= values.email;
    existing.phone ||= values.phone;
    existing.company ||= values.company;
    existing.website_url ||= values.website_url;
    existing.linkedin_url ||= values.linkedin_url;
    existing.birth_year ??= values.birth_year;
    existing.newsletter_status ||= values.newsletter_status;
    existing.notes ||= values.notes;
    existing.context = [...new Set([...existing.context, ...values.context])];
    if (values.created_at && (!existing.created_at || values.created_at < existing.created_at)) existing.created_at = values.created_at;
    addEmailGroup(values.email, id);
  };

  // Contact profiles are the canonical admin-editable fields. Group by an explicit
  // member link first; otherwise use a normalized email match.
  for (const contact of contacts) {
    const id = contact.member_id ? `member:${contact.member_id}` : emailGroup(contact.email, `contact:${contact.id}`);
    if (contact.member_id) memberGroupIds.set(contact.member_id, id);
    addEntry(id, "Contact record", {
      contact_id: contact.id,
      member_id: contact.member_id,
      name: [contact.first_name, contact.last_name].filter(Boolean).join(" "),
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      website_url: null,
      linkedin_url: contact.linkedin_url,
      birth_year: contact.birth_year,
      newsletter_status: contact.newsletter_status,
      notes: contact.notes,
      context: [`${contact.archived_at ? "Archived · " : ""}${contact.newsletter_status} · ${contact.source}${contact.member_id ? " · linked account" : ""}`],
      created_at: contact.created_at,
    });
  }
  for (const profile of profiles) {
    const linkedContactGroup = memberGroupIds.get(profile.id);
    const id = linkedContactGroup ?? emailGroup(profile.email, `member:${profile.id}`);
    memberGroupIds.set(profile.id, id);
    addEntry(id, "Member account", {
      contact_id: null,
      member_id: profile.id,
      name: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email || "Unnamed account",
      email: profile.email,
      phone: profile.phone,
      company: profile.company,
      website_url: null,
      linkedin_url: null,
      birth_year: null,
      newsletter_status: null,
      notes: null,
      context: ["CometX account"],
      created_at: profile.created_at,
    });
  }

  let eventNames = new Map<string, string>();
  if (attendees.length && canRead("events.read")) {
    const eventIds = [...new Set(attendees.map((attendee) => attendee.event_id))];
    const db = await admin("events.read");
    for (let from = 0; from < eventIds.length; from += 500) {
      const { data, error } = await db.from("events").select("id,title").in("id", eventIds.slice(from, from + 500));
      if (error) throw new Error("Guest attendee events could not be loaded.");
      eventNames = new Map([...eventNames, ...(data ?? []).map((event) => [event.id, event.title] as const)]);
    }
  }
  for (const attendee of attendees) {
    const id = emailGroup(attendee.attendee_email, `attendee:${attendee.id}`);
    addEntry(id, "Guest attendee", {
      contact_id: null,
      member_id: null,
      name: attendee.attendee_name,
      email: attendee.attendee_email,
      phone: null,
      company: null,
      website_url: null,
      linkedin_url: null,
      birth_year: null,
      newsletter_status: null,
      notes: null,
      context: [`${eventNames.get(attendee.event_id) ?? "Event ticket"} · ${attendee.status}`],
      created_at: attendee.created_at,
    });
  }
  for (const partner of partners) addEntry(`partner:${partner.id}`, "Partner organization", {
    contact_id: null, member_id: null,
    name: partner.name, email: null, phone: null, company: null, website_url: partner.website_url, linkedin_url: null, birth_year: null,
    newsletter_status: null, notes: null,
    context: [`${partner.active ? "Active" : "Inactive"}${partner.tier ? ` · ${partner.tier}` : ""}`], created_at: partner.created_at,
  });
  for (const speaker of speakers) addEntry(`speaker:${speaker.id}`, "Speaker", {
    contact_id: null, member_id: null,
    name: speaker.name, email: null, phone: null, company: speaker.company, website_url: speaker.website_url, linkedin_url: speaker.linkedin_url, birth_year: null,
    newsletter_status: null, notes: null, context: [speaker.job_title, speaker.event_id ? "Event-specific speaker" : "Reusable speaker"].filter((value): value is string => Boolean(value)), created_at: speaker.created_at,
  });

  for (const entry of entries.values()) entry.name ||= entry.email ?? "Unnamed";

  return {
    entries: [...entries.values()].sort((left, right) => (right.created_at ?? "").localeCompare(left.created_at ?? "")),
    availableTypes: ["Contact record", ...(canRead("members.read") ? ["Member account"] : []), ...(canRead("attendees.read") ? ["Guest attendee"] : []), ...(canRead("partners.read") ? ["Partner organization"] : []), ...(canRead("events.read") ? ["Speaker"] : [])],
  };
});

export const adminPrepareDirectoryContacts = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ people: z.array(z.object({ email: z.string().trim().toLowerCase().email().max(320), memberId: z.string().uuid().nullable() })).min(1).max(100) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin("contacts.write");
    const { requireStaffPermission } = await import("./auth.server");
    const actor = await requireStaffPermission("contacts.write");
    const canReadMembers = hasStaffPermission(actor.staffRoles, "members.read");
    const canReadAttendees = hasStaffPermission(actor.staffRoles, "attendees.read");
    if (!canReadMembers && !canReadAttendees) throw new Error("This role cannot verify directory identities.");
    const requested = [...new Map(data.people.map((person) => [normalizeContactEmail(person.email), person])).values()];
    const existingIndex = await readContactEmailIndex(db);
    const memberIds = requested.flatMap((person) => person.memberId ? [person.memberId] : []);
    const members = memberIds.length && canReadMembers ? await db.from("profiles").select("id,email,first_name,last_name,phone,company").in("id", memberIds) : { data: [], error: null };
    if (members.error) throw new Error(members.error.message);
    const memberById = new Map((members.data ?? []).map((member) => [member.id, member]));
    const guestEmails = new Set<string>();
    if (requested.some((person) => !person.memberId) && canReadAttendees) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const attendeeDb = supabaseAdmin as unknown as GuestAttendeeQueryClient;
      const attendees = await readAllAdminPages<GuestAttendeeDirectoryRow>(async (from, to) => {
        const { data: rows, error } = await attendeeDb.from("ticket_attendees").select("id,attendee_name,attendee_email,event_id,status,created_at").is("user_id", null).order("created_at", { ascending: false }).range(from, to);
        return { data: rows, error };
      });
      for (const attendee of attendees) guestEmails.add(normalizeContactEmail(attendee.attendee_email));
    }
    const contactIds: string[] = [];
    let created = 0;
    let skipped = 0;
    for (const person of requested) {
      const email = normalizeContactEmail(person.email);
      const existing = existingIndex.get(email) ?? [];
      if (existing.length > 1) { skipped++; continue; }
      if (existing.length === 1) {
        const { data: active, error: activeError } = await db.from("contacts").select("id").eq("id", existing[0]!.id).is("archived_at", null).maybeSingle();
        if (activeError) throw new Error(activeError.message);
        if (active) contactIds.push(active.id); else skipped++;
        continue;
      }
      const member = person.memberId ? memberById.get(person.memberId) : null;
      if (person.memberId ? !member || normalizeContactEmail(member.email ?? "") !== email : !guestEmails.has(email)) { skipped++; continue; }
      const { data: inserted, error } = await db.from("contacts").insert({ email, first_name: member?.first_name ?? null, last_name: member?.last_name ?? null, phone: member?.phone ?? null, company: member?.company ?? null, member_id: member?.id ?? null, source: member ? "member_directory" : "guest_directory", newsletter_status: "pending" }).select("id").single();
      if (error || !inserted) { skipped++; continue; }
      created++;
      contactIds.push(inserted.id);
      existingIndex.set(email, [{ id: inserted.id, email }]);
    }
    return { contactIds, created, skipped };
  });

const contactSchema = z.object({
  id: z.string().uuid().optional(),
  email: z.string().trim().toLowerCase().email().max(320),
  first_name: z.string().max(120).nullable().default(null),
  last_name: z.string().max(120).nullable().default(null),
  phone: z.string().max(80).nullable().default(null),
  company: z.string().max(160).nullable().default(null),
  linkedin_url: z.string().trim().url().max(2048).refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && (url.hostname === "linkedin.com" || url.hostname.endsWith(".linkedin.com"));
    } catch {
      return false;
    }
  }, "Enter a valid HTTPS LinkedIn URL.").nullable().default(null),
  birth_year: z.number().int().min(1900).max(new Date().getFullYear()).nullable().default(null),
  source: z.string().trim().min(2).max(80).default("manual"),
  newsletter_status: z.enum(["subscribed", "unsubscribed", "pending"]),
  member_id: z.string().uuid().nullable().default(null),
  notes: z.string().max(5000).nullable().default(null),
});

export const adminListContacts = createServerFn({ method: "GET" })
  .validator((d: unknown) => z.object({ query: z.string().max(160).default(""), status: z.enum(["all", "subscribed", "unsubscribed", "pending"]).default("all"), archive: z.enum(["active", "archived"]).default("active"), segmentId: z.string().uuid().nullable().default(null) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin("contacts.read");
    let request = db.from("contacts").select("*").order("created_at", { ascending: false }).limit(500);
    request = data.archive === "archived" ? request.not("archived_at", "is", null) : request.is("archived_at", null);
    if (data.status !== "all") request = request.eq("newsletter_status", data.status);
    if (data.segmentId) {
      const { data: assignments, error: assignmentError } = await db.from("contact_segment_assignments").select("contact_id").eq("segment_id", data.segmentId);
      if (assignmentError) throw new Error(assignmentError.message);
      if (!assignments?.length) return [];
      request = request.in("id", assignments.map((row) => row.contact_id));
    }
    if (data.query.trim()) {
      const term = data.query.trim().replace(/[,%()]/g, "");
      request = request.or(`email.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,company.ilike.%${term}%`);
    }
    const { data: contacts, error } = await request;
    if (error) throw new Error(error.message);
    return contacts ?? [];
  });

const contactIdsSchema = z.array(z.string().uuid()).min(1).max(500);

export const adminListContactSegments = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ contactIds: z.array(z.string().uuid()).max(500).refine((ids) => new Set(ids).size === ids.length) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin("contacts.read");
    const [{ data: segments, error: segmentError }, assignmentsResult] = await Promise.all([
      db.from("contact_segments").select("id,name,slug,archived_at").order("name"),
      data.contactIds.length ? db.from("contact_segment_assignments").select("contact_id,segment_id").in("contact_id", data.contactIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (segmentError) throw new Error(segmentError.message);
    if (assignmentsResult.error) throw new Error(assignmentsResult.error.message);
    return { segments: segments ?? [], assignments: assignmentsResult.data ?? [] };
  });

const manageContactSegmentSchema = z.union([
  z.object({ action: z.literal("create"), name: z.string().trim().min(1).max(80) }),
  z.object({ action: z.literal("rename"), id: z.string().uuid(), name: z.string().trim().min(1).max(80) }),
  z.object({ action: z.enum(["archive", "restore"]), id: z.string().uuid() }),
]);

export const adminManageContactSegment = createServerFn({ method: "POST" })
  .validator((d: unknown) => manageContactSegmentSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin("contacts.write");
    if (data.action === "create" || data.action === "rename") {
      const name = data.name.trim().replace(/\s+/g, " ");
      const slug = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
      if (!slug) throw new Error("Use a segment name containing letters or numbers.");
      const { data: existing, error: lookupError } = await db.from("contact_segments").select("id,name,slug");
      if (lookupError) throw new Error(lookupError.message);
      if (existing?.some((segment) => segment.id !== (data.action === "rename" ? data.id : undefined) && (segment.slug === slug || segment.name.toLocaleLowerCase() === name.toLocaleLowerCase()))) throw new Error("A segment with this name already exists. Restore it if archived.");
      if (data.action === "create") {
        const { error } = await db.from("contact_segments").insert({ name, slug });
        if (error) throw new Error(error.message);
      } else {
        const { data: changed, error } = await db.from("contact_segments").update({ name, slug }).eq("id", data.id).select("id");
        if (error) throw new Error(error.message);
        if (!changed?.length) throw new Error("Segment no longer exists. Refresh and try again.");
      }
      return { message: data.action === "create" ? "Segment created." : "Segment renamed." };
    }
    const { data: changed, error } = await db.from("contact_segments").update({ archived_at: data.action === "archive" ? new Date().toISOString() : null }).eq("id", data.id).select("id");
    if (error) throw new Error(error.message);
    if (!changed?.length) throw new Error("Segment no longer exists. Refresh and try again.");
    return { message: data.action === "archive" ? "Segment archived. Existing assignments remain." : "Segment restored." };
  });

const contactBulkSchema = z.union([
  z.object({ action: z.literal("newsletter"), contactIds: contactIdsSchema, status: z.enum(["subscribed", "unsubscribed"]), consentConfirmed: z.boolean() }),
  z.object({ action: z.literal("segment_assign"), contactIds: contactIdsSchema, segmentId: z.string().uuid().optional(), segmentName: z.string().trim().min(1).max(80).optional() }),
  z.object({ action: z.literal("segment_remove"), contactIds: contactIdsSchema, segmentId: z.string().uuid() }),
]);
export type AdminBulkContactInput = z.infer<typeof contactBulkSchema>;

export const adminBulkUpdateContacts = createServerFn({ method: "POST" })
  .validator((d: unknown) => contactBulkSchema.parse(d))
  .handler(async ({ data }) => {
    if (new Set(data.contactIds).size !== data.contactIds.length) throw new Error("Choose each contact only once.");
    const permission = data.action === "newsletter" ? "newsletter.write" : "contacts.write";
    const db = await admin(permission);
    if (data.action === "newsletter" && !data.consentConfirmed) throw new Error("Confirm the consent or unsubscribe action before continuing.");

    const { data: activeContacts, error: contactError } = await db.from("contacts").select("id,newsletter_status").in("id", data.contactIds).is("archived_at", null);
    if (contactError) throw new Error(contactError.message);
    if ((activeContacts ?? []).length !== data.contactIds.length) throw new Error("One or more selected contacts are archived or no longer available. Refresh the list and try again.");

    if (data.action === "newsletter") {
      const changedIds = (activeContacts ?? []).filter((contact) => contact.newsletter_status !== data.status).map((contact) => contact.id);
      if (changedIds.length === 0) return { updated: 0, skipped: data.contactIds.length, failed: 0 };
      const fields = data.status === "subscribed"
        ? { newsletter_status: "subscribed" as const, consent_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        : { newsletter_status: "unsubscribed" as const, updated_at: new Date().toISOString() };
      const { data: updated, error } = await db.from("contacts").update(fields).in("id", changedIds).is("archived_at", null).select("id");
      if (error) throw new Error(error.message);
      const updatedCount = updated?.length ?? 0;
      return { updated: updatedCount, skipped: data.contactIds.length - changedIds.length, failed: changedIds.length - updatedCount };
    }

    let segmentId = data.action === "segment_remove" ? data.segmentId : data.segmentId;
    if (data.action === "segment_assign" && !segmentId) {
      if (!data.segmentName) throw new Error("Choose or enter a segment.");
      const name = data.segmentName.trim().replace(/\s+/g, " ");
      const slug = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
      if (!slug) throw new Error("Enter a segment name containing letters or numbers.");
      const { error: createError } = await db.from("contact_segments").upsert({ name, slug }, { onConflict: "slug", ignoreDuplicates: true });
      if (createError) throw new Error(createError.message);
      const { data: segment, error: lookupError } = await db.from("contact_segments").select("id,archived_at").eq("slug", slug).single();
      if (lookupError || !segment) throw new Error(lookupError?.message ?? "Could not create or find that segment.");
      if (segment.archived_at) throw new Error("That segment is archived. Restore it before assigning contacts.");
      segmentId = segment.id;
    }
    if (data.action === "segment_assign") {
      const { data: selectedSegment, error: segmentError } = await db.from("contact_segments").select("archived_at").eq("id", segmentId!).single();
      if (segmentError || !selectedSegment) throw new Error(segmentError?.message ?? "Segment no longer exists.");
      if (selectedSegment.archived_at) throw new Error("That segment is archived. Restore it before assigning contacts.");
      const { data: existingAssignments, error: existingError } = await db.from("contact_segment_assignments").select("contact_id").eq("segment_id", segmentId!).in("contact_id", data.contactIds);
      if (existingError) throw new Error(existingError.message);
      const alreadyAssigned = new Set((existingAssignments ?? []).map((row) => row.contact_id));
      const missing = data.contactIds.filter((id) => !alreadyAssigned.has(id));
      if (!missing.length) return { updated: 0, skipped: data.contactIds.length, failed: 0 };
      const { data: inserted, error } = await db.from("contact_segment_assignments").upsert(missing.map((contact_id) => ({ contact_id, segment_id: segmentId! })), { onConflict: "contact_id,segment_id", ignoreDuplicates: true }).select("contact_id");
      if (error) throw new Error(error.message);
      const updatedCount = inserted?.length ?? 0;
      return { updated: updatedCount, skipped: data.contactIds.length - missing.length, failed: missing.length - updatedCount };
    }

    const { data: removed, error } = await db.from("contact_segment_assignments").delete().eq("segment_id", segmentId!).in("contact_id", data.contactIds).select("contact_id");
    if (error) throw new Error(error.message);
    const updatedCount = removed?.length ?? 0;
    return { updated: updatedCount, skipped: data.contactIds.length - updatedCount, failed: 0 };
  });

export const adminSaveContact = createServerFn({ method: "POST" })
  .validator((d: unknown) => contactSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin("contacts.write");
    const { id, ...fields } = data;
    const emailIndex = await readContactEmailIndex(db);
    const duplicates = (emailIndex.get(fields.email) ?? []).filter((contact) => contact.id !== id);
    if (duplicates.length) throw new Error("A contact with this normalized email already exists. Open the existing record instead.");

    let current: { newsletter_status: "subscribed" | "unsubscribed" | "pending"; consent_at: string | null } | null = null;
    if (id) {
      const { data: existing, error: lookupError } = await db.from("contacts").select("newsletter_status,consent_at").eq("id", id).is("archived_at", null).maybeSingle();
      if (lookupError) throw new Error(lookupError.message);
      if (!existing) throw new Error("This contact is archived or no longer exists. Restore it before editing.");
      current = existing;
    }
    const payload = {
      ...fields,
      consent_at: fields.newsletter_status === "subscribed"
        ? current?.newsletter_status === "subscribed" ? current.consent_at : new Date().toISOString()
        : current?.consent_at ?? null,
    };
    const { error } = id ? await db.from("contacts").update(payload).eq("id", id).is("archived_at", null) : await db.from("contacts").insert(payload);
    if (error) throw new Error(error.code === "23505" ? "A contact with this email already exists." : error.message);
    return { ok: true };
  });

export const adminArchiveContact = createServerFn({ method: "POST" })
  .validator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin("contacts.write");
    const { data: contact, error } = await db.from("contacts").update({ archived_at: new Date().toISOString() }).eq("id", data.id).is("archived_at", null).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!contact) throw new Error("This contact is already archived or no longer exists.");
    return { ok: true };
  });

export const adminRestoreContact = createServerFn({ method: "POST" })
  .validator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin("contacts.write");
    const { data: contact, error } = await db.from("contacts").update({ archived_at: null }).eq("id", data.id).not("archived_at", "is", null).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!contact) throw new Error("This contact is active already or no longer exists.");
    return { ok: true };
  });

const contactImportFieldsSchema = z.object({
  first_name: z.string().max(120).optional(),
  last_name: z.string().max(120).optional(),
  phone: z.string().max(80).optional(),
  company: z.string().max(160).optional(),
  source: z.string().min(2).max(80).optional(),
  notes: z.string().max(5000).optional(),
}).strict();

const contactImportRowSchema = z.object({
  rowNumber: z.number().int().min(2).max(100_000),
  email: z.string().email().max(320),
  fields: contactImportFieldsSchema,
});

async function readContactEmailIndex(db: SupabaseClient) {
  const matches = new Map<string, { id: string; email: string }[]>();
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db.from("contacts").select("id,email").order("id", { ascending: true }).range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    for (const contact of data ?? []) {
      const email = normalizeContactEmail(contact.email);
      if (!email) continue;
      const values = matches.get(email) ?? [];
      values.push({ id: contact.id, email: contact.email });
      matches.set(email, values);
    }
    if (!data || data.length < pageSize) break;
  }
  return matches;
}

export const adminPreviewContactImport = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ emails: z.array(z.string().email().max(320)).max(2000) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin("contacts.read");
    const emailIndex = await readContactEmailIndex(db);
    const emails = [...new Set(data.emails.map(normalizeContactEmail))];
    return {
      matches: emails.flatMap((email) => {
        const count = emailIndex.get(email)?.length ?? 0;
        return count > 0 ? [{ email, count }] : [];
      }),
    };
  });

export const adminImportContacts = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({
    mode: z.enum(["skip_existing", "update_existing"]),
    rows: z.array(contactImportRowSchema).min(1).max(2000),
  }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin("contacts.write");
    const emailIndex = await readContactEmailIndex(db);
    const seenInFile = new Set<string>();
    const summary = { created: 0, updated: 0, skipped: 0, failed: 0 };
    const results: { rowNumber: number; email: string; status: "created" | "updated" | "skipped" | "failed"; message: string }[] = [];

    for (const row of data.rows) {
      const email = normalizeContactEmail(row.email);
      if (seenInFile.has(email)) {
        summary.skipped += 1;
        results.push({ rowNumber: row.rowNumber, email, status: "skipped", message: "Duplicate email in this file; the first row was kept." });
        continue;
      }
      seenInFile.add(email);

      const existing = emailIndex.get(email) ?? [];
      if (existing.length > 1) {
        summary.failed += 1;
        results.push({ rowNumber: row.rowNumber, email, status: "failed", message: "More than one existing contact has this normalized email. Resolve those records before importing." });
        continue;
      }

      if (existing.length === 1) {
        if (data.mode === "skip_existing") {
          summary.skipped += 1;
          results.push({ rowNumber: row.rowNumber, email, status: "skipped", message: "An existing contact was found and the selected mode skips existing contacts." });
          continue;
        }

        const firstName = row.fields.first_name?.trim();
        const lastName = row.fields.last_name?.trim();
        const phone = row.fields.phone?.trim();
        const company = row.fields.company?.trim();
        const source = row.fields.source?.trim();
        const notes = row.fields.notes?.trim();
        const fields = {
          ...(firstName ? { first_name: firstName } : {}),
          ...(lastName ? { last_name: lastName } : {}),
          ...(phone ? { phone } : {}),
          ...(company ? { company } : {}),
          ...(source ? { source } : {}),
          ...(notes ? { notes } : {}),
        };
        if (Object.keys(fields).length === 0) {
          summary.skipped += 1;
          results.push({ rowNumber: row.rowNumber, email, status: "skipped", message: "No non-empty mapped fields to update." });
          continue;
        }

        const existingContact = existing[0];
        if (!existingContact) {
          summary.failed += 1;
          results.push({ rowNumber: row.rowNumber, email, status: "failed", message: "The contact could not be identified for update." });
          continue;
        }
        const { data: updated, error } = await db.from("contacts").update(fields).eq("id", existingContact.id).select("id").maybeSingle();
        if (error || !updated) {
          summary.failed += 1;
          results.push({ rowNumber: row.rowNumber, email, status: "failed", message: error?.message ?? "The contact no longer exists." });
          continue;
        }
        summary.updated += 1;
        results.push({ rowNumber: row.rowNumber, email, status: "updated", message: "Updated mapped, non-empty fields; email, newsletter status and member link were preserved." });
        continue;
      }

      const payload = {
        email,
        first_name: row.fields.first_name ?? null,
        last_name: row.fields.last_name ?? null,
        phone: row.fields.phone ?? null,
        company: row.fields.company ?? null,
        source: row.fields.source ?? "csv_import",
        notes: row.fields.notes ?? null,
        newsletter_status: "pending" as const,
      };
      const { error } = await db.from("contacts").insert(payload);
      if (error?.code === "23505") {
        summary.skipped += 1;
        results.push({ rowNumber: row.rowNumber, email, status: "skipped", message: "A contact with this email was added during import; this row was skipped." });
        continue;
      }
      if (error) {
        summary.failed += 1;
        results.push({ rowNumber: row.rowNumber, email, status: "failed", message: error.message });
        continue;
      }
      summary.created += 1;
      results.push({ rowNumber: row.rowNumber, email, status: "created", message: "Created a contact with newsletter status pending. No member account was created." });
    }

    return { summary, results };
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
