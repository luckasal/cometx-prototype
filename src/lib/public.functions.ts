import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isPublicEventListingCandidate } from "./public-event-visibility";

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({ email: z.string().email().max(320), firstName: z.string().max(120).optional() })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { getPublicClient } = await import("./database.server");
    const { error } = await getPublicClient().rpc("subscribe_newsletter", {
      p_email: data.email,
      p_first_name: data.firstName ?? null,
    });
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
      .select(
        "title,title_en,slug,short_description,short_description_en,hero_image_url,start_date,venue,venue_en,event_status,featured",
      )
      .eq("publish_state", "published")
      .in("event_status", ["upcoming", "registration_open", "registration_closed", "sold_out"])
      .gte("start_date", nowIso)
      .order("start_date")
      .limit(3),
    supabaseAdmin
      .from("events")
      .select(
        "title,title_en,slug,short_description,short_description_en,description,description_en,hero_image_url,start_date,venue,venue_en,event_status",
      )
      .eq("featured", true)
      .eq("publish_state", "published")
      .in("event_status", [
        "upcoming",
        "registration_open",
        "registration_closed",
        "sold_out",
        "completed",
        "cancelled",
      ])
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("articles")
      .select("title,title_en,slug,excerpt,excerpt_en,hero_image_url,published_at,visibility")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(3),
    supabaseAdmin.from("partners").select("name,tier,website_url").eq("active", true).order("name"),
    supabaseAdmin
      .from("membership_plans")
      .select("name,name_en,slug,description,description_en,annual_price,currency")
      .eq("active", true)
      .order("sort_order"),
  ]);

  [events, featured, articles, partners, plans].forEach(assertDatabaseResult);
  return {
    upcoming: (events.data ?? [])
      .filter(isPublicEventListingCandidate)
      .map((event) => ({ ...event, status: event.event_status })),
    featured:
      featured.data && isPublicEventListingCandidate(featured.data)
        ? { ...featured.data, status: featured.data.event_status }
        : null,
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
      "title,title_en,slug,short_description,short_description_en,hero_image_url,start_date,venue,venue_en,event_status,featured,capacity",
    )
    .eq("publish_state", "published")
    .order("start_date", { ascending: false });

  assertDatabaseResult({ error });
  const now = Date.now();
  const all = (data ?? [])
    .filter(isPublicEventListingCandidate)
    .map((event) => ({ ...event, status: event.event_status }));
  const featured = all.filter((event) => event.featured);
  const standardEvents = all.filter((event) => !event.featured);
  return {
    upcoming: standardEvents
      .filter(
        (e) =>
          new Date(e.start_date).getTime() >= now &&
          !["completed", "cancelled"].includes(e.event_status),
      )
      .sort((a, b) => +new Date(a.start_date) - +new Date(b.start_date)),
    past: standardEvents.filter(
      (e) =>
        new Date(e.start_date).getTime() < now ||
        ["completed", "cancelled"].includes(e.event_status),
    ),
    featured,
  };
});

export const listPartners = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublicClient, assertDatabaseResult } = await import("./database.server");
  const { data, error } = await getPublicClient()
    .from("partners")
    .select("id,name,description,description_en,tier,website_url,logo_url")
    .eq("active", true)
    .order("name");
  assertDatabaseResult({ error });
  return data ?? [];
});

export type PublicMemberProfile = {
  name: string;
  company: string | null;
  jobTitle: string | null;
  country: string | null;
};

/** Public directory returns only explicitly published profiles for current members. */
export const listPublicMembers = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicMemberProfile[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { data: memberships, error: membershipError } = await supabaseAdmin
      .from("memberships")
      .select("user_id")
      .eq("status", "active")
      .lte("starts_at", now)
      .or(`ends_at.is.null,ends_at.gt.${now}`);
    if (membershipError) throw new Error("We could not load the public member directory.");
    const memberIds = [...new Set((memberships ?? []).map((membership) => membership.user_id))];
    if (memberIds.length === 0) return [];

    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("first_name,last_name,company,job_title,country")
      .eq("public_directory_visible", true)
      .in("id", memberIds)
      .order("last_name")
      .order("first_name");
    if (profileError) throw new Error("We could not load the public member directory.");

    return (profiles ?? [])
      .filter((profile) => profile.first_name?.trim() && profile.last_name?.trim())
      .map((profile) => ({
        name: `${profile.first_name!.trim()} ${profile.last_name!.trim()}`,
        company: profile.company,
        jobTitle: profile.job_title,
        country: profile.country,
      }));
  },
);

export type PublicMediaItem = {
  id: string;
  title: string;
  titleEn: string | null;
  kind: "photo" | "video";
  url: string;
  imageUrl: string | null;
  publishedAt: string | null;
  eventSlug: string | null;
};

/** Public archive reads only media attached to published events and published media entries. */
export const listPublicMedia = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicMediaItem[]> => {
    const { getPublicClient, assertDatabaseResult } = await import("./database.server");
    const db = getPublicClient();
    const [events, entries] = await Promise.all([
      db
        .from("events")
        .select(
          "id,title,title_en,slug,hero_image_url,gallery_urls,start_date,event_status,publish_state",
        )
        .eq("publish_state", "published")
        .in("event_status", [
          "upcoming",
          "registration_open",
          "registration_closed",
          "sold_out",
          "completed",
        ])
        .order("start_date", { ascending: false }),
      db
        .from("content_entries")
        .select("id,content_type,title,title_en,hero_image_url,media_urls,published_at,status")
        .eq("status", "published")
        .in("content_type", ["video", "gallery"])
        .order("published_at", { ascending: false }),
    ]);
    assertDatabaseResult({ error: events.error });
    assertDatabaseResult({ error: entries.error });

    const media: PublicMediaItem[] = [];
    for (const event of events.data ?? []) {
      if (!isPublicEventListingCandidate(event)) continue;
      const urls = Array.isArray(event.gallery_urls)
        ? event.gallery_urls.filter(
            (url): url is string => typeof url === "string" && /^https?:\/\//i.test(url),
          )
        : [];
      urls.forEach((url, index) =>
        media.push({
          id: `event-${event.id}-${index}`,
          title: event.title,
          titleEn: event.title_en,
          kind: "photo",
          url,
          imageUrl: url,
          publishedAt: event.start_date,
          eventSlug: event.slug,
        }),
      );
    }

    for (const entry of entries.data ?? []) {
      const urls = Array.isArray(entry.media_urls)
        ? entry.media_urls.filter(
            (url): url is string => typeof url === "string" && /^https?:\/\//i.test(url),
          )
        : [];
      const candidates =
        urls.length > 0 ? urls : entry.hero_image_url ? [entry.hero_image_url] : [];
      candidates.forEach((url, index) => {
        const video = entry.content_type === "video";
        media.push({
          id: `content-${entry.id}-${index}`,
          title: entry.title,
          titleEn: entry.title_en,
          kind: video ? "video" : "photo",
          url,
          imageUrl: video ? entry.hero_image_url : url,
          publishedAt: entry.published_at,
          eventSlug: null,
        });
      });
    }

    return media.sort((a, b) => Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? ""));
  },
);
