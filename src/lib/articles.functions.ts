import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ArticleCard = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  heroImageUrl: string | null;
  publishedAt: string | null;
  visibility: string;
};

export type ArticleView = {
  article: ArticleCard & { body: string | null };
  locked: boolean;
  lockReason: string | null;
};

export const listArticles = createServerFn({ method: "GET" }).handler(
  async (): Promise<ArticleCard[]> => {
    const { getReadClient, assertDatabaseResult } = await import("./database.server");
    const supabaseAdmin = process.env["SUPABASE_SERVICE_ROLE_KEY"]
      ? (await import("@/integrations/supabase/client.server")).supabaseAdmin
      : getReadClient();
    const { data, error } = await supabaseAdmin
      .from("articles")
      .select("id,title,slug,excerpt,hero_image_url,published_at,visibility")
      .eq("status", "published")
      .order("published_at", { ascending: false });

    assertDatabaseResult({ error });
    return (data ?? []).map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt,
      heroImageUrl: a.hero_image_url,
      publishedAt: a.published_at,
      visibility: a.visibility,
    }));
  },
);

/** Gating happens here, on the server. The body is never sent to an ineligible reader. */
export const getArticle = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ slug: z.string().min(1).max(200) }).parse(data))
  .handler(async ({ data }): Promise<ArticleView | null> => {
    const { getReadClient, assertDatabaseResult } = await import("./database.server");
    const supabaseAdmin = process.env["SUPABASE_SERVICE_ROLE_KEY"]
      ? (await import("@/integrations/supabase/client.server")).supabaseAdmin
      : getReadClient();
    const { getOptionalUser, isAdmin } = await import("./auth.server");
    const { getCurrentMembership, getUserEntitlements } = await import("./membership.server");

    const { data: article, error } = await supabaseAdmin
      .from("articles")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();

    assertDatabaseResult({ error });
    if (!article) return null;

    const user = await getOptionalUser();
    const admin = user ? await isAdmin(user.userId) : false;
    if (article.status !== "published" && !admin) return null;

    let locked = false;
    let lockReason: string | null = null;

    if (!admin) {
      if (article.visibility === "registered" && !user) {
        locked = true;
        lockReason = "Create a free CometX account to keep reading.";
      } else if (article.visibility === "members") {
        const membership = await getCurrentMembership(user?.userId);
        if (!membership) {
          locked = true;
          lockReason = "Join CometX to continue reading.";
        }
      } else if (article.visibility === "entitlement") {
        const entitlements = await getUserEntitlements(user?.userId);
        const key = article.required_entitlement;
        if (!key || !(key in entitlements)) {
          locked = true;
          lockReason = "This story is available to members with the matching benefit.";
        }
      }
    }

    const body = article.body ?? "";

    return {
      article: {
        id: article.id,
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt,
        heroImageUrl: article.hero_image_url,
        publishedAt: article.published_at,
        visibility: article.visibility,
        body: locked ? article.excerpt : body,
      },
      locked,
      lockReason,
    };
  });
