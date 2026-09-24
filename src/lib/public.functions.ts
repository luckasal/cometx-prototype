import { createServerFn } from "@tanstack/react-start";

export const getHomeData = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublicClient, assertDatabaseResult } = await import("./database.server");
  const supabaseAdmin = getPublicClient();
  const nowIso = new Date().toISOString();

  const [events, featured, articles, partners, plans] = await Promise.all([
    supabaseAdmin
      .from("events")
      .select("title,slug,short_description,hero_image_url,start_date,venue,status,featured")
      .in("status", ["published", "registration_open", "sold_out"])
      .gte("start_date", nowIso)
      .order("start_date")
      .limit(3),
    supabaseAdmin
      .from("events")
      .select("title,slug,short_description,description,hero_image_url,start_date,venue,status")
      .eq("featured", true)
      .in("status", ["published", "registration_open", "sold_out", "completed"])
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
    upcoming: events.data ?? [],
    featured: featured.data ?? null,
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
      "title,slug,short_description,hero_image_url,start_date,venue,status,featured,capacity",
    )
    .in("status", ["published", "registration_open", "sold_out", "completed"])
    .order("start_date", { ascending: false });

  assertDatabaseResult({ error });
  const now = Date.now();
  const all = data ?? [];
  return {
    upcoming: all
      .filter((e) => new Date(e.start_date).getTime() >= now && e.status !== "completed")
      .sort((a, b) => +new Date(a.start_date) - +new Date(b.start_date)),
    past: all.filter((e) => new Date(e.start_date).getTime() < now || e.status === "completed"),
    featured: all.filter((e) => e.featured),
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
