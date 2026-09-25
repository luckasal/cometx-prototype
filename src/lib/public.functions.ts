import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ email: z.string().email().max(320), firstName: z.string().max(120).optional() }).parse(data))
  .handler(async ({ data }) => {
    const { getPublicClient } = await import("./database.server");
    const { error } = await getPublicClient().rpc("subscribe_newsletter", { p_email: data.email, p_first_name: data.firstName ?? null });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getHomeData = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublicClient, assertDatabaseResult } = await import("./database.server");
  const supabaseAdmin = getPublicClient();
  const nowIso = new Date().toISOString();

  const [events, featured, articles, partners, plans] = await Promise.all([
    supabaseAdmin
      .from("events")
      .select("title,slug,short_description,hero_image_url,start_date,venue,event_status,featured")
      .eq("publish_state", "published")
      .in("event_status", ["upcoming", "registration_open", "registration_closed", "sold_out"])
      .gte("start_date", nowIso)
      .order("start_date")
      .limit(3),
    supabaseAdmin
      .from("events")
      .select("title,slug,short_description,description,hero_image_url,start_date,venue,event_status")
      .eq("featured", true)
      .eq("publish_state", "published")
      .in("event_status", ["upcoming", "registration_open", "registration_closed", "sold_out", "completed", "cancelled"])
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("articles")
      .select("title,slug,excerpt,hero_image_url,published_at,visibility")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(3),
    supabaseAdmin.from("partners").select("name,tier,website_url").eq("active", true).order("name"),
    supabaseAdmin
      .from("membership_plans")
      .select("name,slug,description,annual_price,currency")
      .eq("active", true)
      .order("sort_order"),
  ]);

  [events, featured, articles, partners, plans].forEach(assertDatabaseResult);
  return {
    upcoming: (events.data ?? []).map((event) => ({ ...event, status: event.event_status })),
    featured: featured.data ? { ...featured.data, status: featured.data.event_status } : null,
    articles: articles.data ?? [],
    partners: partners.data ?? [],
    plans: plans.data ?? [],
  };
});

export const listEvents = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublicClient, assertDatabaseResult } = await import("./database.server");
  const { data, error } = await getPublicClient()
    .from("events")
    .select(
      "title,slug,short_description,hero_image_url,start_date,venue,event_status,featured,capacity",
    )
    .eq("publish_state", "published")
    .order("start_date", { ascending: false });

  assertDatabaseResult({ error });
  const now = Date.now();
  const all = (data ?? []).map((event) => ({ ...event, status: event.event_status }));
  const featured = all.filter((event) => event.featured);
  const standardEvents = all.filter((event) => !event.featured);
  return {
    upcoming: standardEvents
      .filter((e) => new Date(e.start_date).getTime() >= now && !["completed", "cancelled"].includes(e.event_status))
      .sort((a, b) => +new Date(a.start_date) - +new Date(b.start_date)),
    past: standardEvents.filter((e) => new Date(e.start_date).getTime() < now || ["completed", "cancelled"].includes(e.event_status)),
    featured,
  };
});

export const listPartners = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublicClient, assertDatabaseResult } = await import("./database.server");
  const { data, error } = await getPublicClient()
    .from("partners")
    .select("id,name,description,tier,website_url,logo_url")
    .eq("active", true)
    .order("name");
  assertDatabaseResult({ error });
  return data ?? [];
});
