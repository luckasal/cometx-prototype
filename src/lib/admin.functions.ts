import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const idSchema = z.object({ id: z.string().uuid() });

async function admin() {
  const { requireAdmin } = await import("./auth.server");
  const { getReadClient } = await import("./database.server");
  await requireAdmin();
  return getReadClient();
}

/* ---------------------------------- dashboard --------------------------------- */

export const getAdminDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const [events, registrations, members, articles, partners, speakers] = await Promise.all([
    db.from("events").select("id", { count: "exact", head: true }),
    db.from("registrations").select("id", { count: "exact", head: true }),
    db.from("memberships").select("id", { count: "exact", head: true }).eq("status", "active"),
    db.from("articles").select("id", { count: "exact", head: true }),
    db.from("partners").select("id", { count: "exact", head: true }),
    db.from("speakers").select("id", { count: "exact", head: true }),
  ]);
  return {
    events: events.count ?? 0,
    registrations: registrations.count ?? 0,
    activeMembers: members.count ?? 0,
    articles: articles.count ?? 0,
    partners: partners.count ?? 0,
    speakers: speakers.count ?? 0,
  };
});

/* ----------------------------------- events ----------------------------------- */

const eventSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(2).max(200),
  slug: z
    .string()
    .min(2)
    .max(200)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes only"),
  short_description: z.string().max(400).nullable().default(null),
  description: z.string().max(20000).nullable().default(null),
  hero_image_url: z.string().url().nullable().default(null),
  start_date: z.string().min(1),
  end_date: z.string().nullable().default(null),
  venue: z.string().max(200).nullable().default(null),
  address: z.string().max(300).nullable().default(null),
  capacity: z.number().int().positive().nullable().default(null),
  registration_start: z.string().nullable().default(null),
  registration_end: z.string().nullable().default(null),
  status: z.enum([
    "draft",
    "published",
    "registration_open",
    "sold_out",
    "completed",
    "cancelled",
  ]),
  featured: z.boolean().default(false),
});

export const adminListEvents = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data } = await db
    .from("events")
    .select("id,title,slug,status,start_date,capacity,featured")
    .order("start_date", { ascending: false });
  return data ?? [];
});

export const adminGetEvent = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const [{ data: event }, { data: tickets }, { data: speakers }] = await Promise.all([
      db.from("events").select("*").eq("id", data.id).maybeSingle(),
      db.from("ticket_types").select("*").eq("event_id", data.id).order("sort_order"),
      db.from("event_speakers").select("speaker_id").eq("event_id", data.id),
    ]);
    return {
      event,
      tickets: tickets ?? [],
      speakerIds: (speakers ?? []).map((s) => s.speaker_id),
    };
  });

export const adminSaveEvent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        event: eventSchema,
        speakerIds: z.array(z.string().uuid()).default([]),
        tickets: z
          .array(
            z.object({
              id: z.string().uuid().optional(),
              name: z.string().min(1).max(160),
              description: z.string().max(500).nullable().default(null),
              base_price: z.number().min(0),
              currency: z.string().length(3).default("CHF"),
              capacity: z.number().int().positive().nullable().default(null),
              required_entitlement: z.string().nullable().default(null),
              discount_entitlement: z.string().nullable().default(null),
              free_entitlement: z.string().nullable().default(null),
            }),
          )
          .default([]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { id, ...fields } = data.event;

    const { data: saved, error } = id
      ? await db.from("events").update(fields).eq("id", id).select("id,slug").single()
      : await db.from("events").insert(fields).select("id,slug").single();

    if (error) {
      if (error.code === "23505") throw new Error("An event with that slug already exists.");
      throw new Error(error.message);
    }

    const { assertDatabaseResult } = await import("./database.server");
    assertDatabaseResult(await db.from("event_speakers").delete().eq("event_id", saved.id));
    if (data.speakerIds.length) {
      assertDatabaseResult(await db
        .from("event_speakers")
        .insert(data.speakerIds.map((sid, i) => ({ event_id: saved.id, speaker_id: sid, sort_order: i }))));
    }

    for (const [index, ticket] of data.tickets.entries()) {
      const { id: ticketId, ...ticketFields } = ticket;
      const payload = { ...ticketFields, event_id: saved.id, sort_order: index };
      if (ticketId) assertDatabaseResult(await db.from("ticket_types").update(payload).eq("id", ticketId).eq("event_id", saved.id));
      else assertDatabaseResult(await db.from("ticket_types").insert(payload));
    }

    return { id: saved.id, slug: saved.slug };
  });

export const adminDeleteEvent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db.from("events").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
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
  company: z.string().max(160).nullable().default(null),
  bio: z.string().max(4000).nullable().default(null),
  photo_url: z.string().url().nullable().default(null),
  linkedin_url: z.string().url().nullable().default(null),
  website_url: z.string().url().nullable().default(null),
});

export const adminListSpeakers = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data } = await db.from("speakers").select("*").order("name");
  return data ?? [];
});

export const adminSaveSpeaker = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => speakerSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { id, ...fields } = data;
    const { error } = id
      ? await db.from("speakers").update(fields).eq("id", id)
      : await db.from("speakers").insert(fields);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteSpeaker = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db.from("speakers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------------------------- articles ---------------------------------- */

const articleSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(2).max(240),
  slug: z
    .string()
    .min(2)
    .max(240)
    .regex(/^[a-z0-9-]+$/),
  excerpt: z.string().max(600).nullable().default(null),
  body: z.string().max(60000).nullable().default(null),
  hero_image_url: z.string().url().nullable().default(null),
  status: z.enum(["draft", "published"]),
  visibility: z.enum(["public", "registered", "members", "entitlement"]),
  required_entitlement: z.string().nullable().default(null),
  published_at: z.string().nullable().default(null),
});

export const adminListArticles = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data } = await db
    .from("articles")
    .select("id,title,slug,status,visibility,published_at")
    .order("created_at", { ascending: false });
  return data ?? [];
});

export const adminGetArticle = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: article } = await db.from("articles").select("*").eq("id", data.id).maybeSingle();
    return article;
  });

export const adminSaveArticle = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => articleSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
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
    const db = await admin();
    const { error } = await db.from("articles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------- membership plans ------------------------------ */

export const adminListPlans = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data } = await db
    .from("membership_plans")
    .select("*, plan_entitlements(value, entitlements(key,name))")
    .order("sort_order");
  return data ?? [];
});

export const adminSavePlan = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(2).max(120),
        slug: z
          .string()
          .min(2)
          .max(120)
          .regex(/^[a-z0-9-]+$/),
        description: z.string().max(1000).nullable().default(null),
        annual_price: z.number().min(0),
        currency: z.string().length(3).default("CHF"),
        active: z.boolean().default(true),
        sort_order: z.number().int().default(0),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { id, ...fields } = data;
    const { error } = id
      ? await db.from("membership_plans").update(fields).eq("id", id)
      : await db.from("membership_plans").insert(fields);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------------- registrations & members --------------------------- */

export const adminListRegistrations = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
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
  const db = await admin();
  const { data: profiles } = await db
    .from("profiles")
    .select("id,first_name,last_name,email,company,country,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const { data: memberships } = await db
    .from("memberships")
    .select("user_id,status,ends_at,membership_plans(name)")
    .eq("status", "active");

  const byUser = new Map((memberships ?? []).map((m) => [m.user_id, m]));
  return (profiles ?? []).map((p) => ({
    ...p,
    planName: byUser.get(p.id)?.membership_plans?.name ?? null,
    membershipStatus: byUser.get(p.id)?.status ?? null,
  }));
});

export const adminListPartners = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data } = await db.from("partners").select("*").order("name");
  return data ?? [];
});

export const adminListWorkshops = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data } = await db
    .from("workshops")
    .select("id,title,start_time,location,base_price,events(title),speakers(name)")
    .order("start_time");
  return data ?? [];
});

export const adminListEntitlements = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data } = await db.from("entitlements").select("key,name").order("key");
  return data ?? [];
});
