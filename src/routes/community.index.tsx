import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listArticles } from "@/lib/articles.functions";
import {
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  PageHero,
  Section,
  StatusPill,
} from "@/components/site/Bits";

export const Route = createFileRoute("/community/")({
  head: () => ({
    meta: [
      { title: "Community stories - CometX" },
      {
        name: "description",
        content:
          "Essays, pay surveys and notes from the CometX community. Some stories are open, some are for members.",
      },
      { property: "og:title", content: "CometX community stories" },
      {
        property: "og:description",
        content: "Essays, surveys and notes from Czech and Slovak professionals in Switzerland.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CommunityPage,
});

function CommunityPage() {
  const fetchArticles = useServerFn(listArticles);
  const { data, isLoading, error } = useQuery({
    queryKey: ["articles"],
    queryFn: () => fetchArticles(),
  });

  return (
    <>
      <PageHero
        eyebrow="Community"
        title="Opinions, reports and Swiss expat life"
        lead="Stories from CometX events and the people connecting science, business, diplomacy and community across Switzerland."
      />
      <Section>
        {isLoading && <LoadingBlock label="Loading stories" />}
        {error && <ErrorBlock error={error} />}
        {data && data.length === 0 && <EmptyBlock title="No stories published yet" />}
        {data && data.length > 0 && (
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
            {data.map((article) => (
              <Link
                key={article.slug}
                to="/community/articles/$slug"
                params={{ slug: article.slug }}
                className="group flex flex-col"
              >
                <div className="aspect-[16/10] overflow-hidden bg-muted">
                  {article.heroImageUrl && (
                    <img
                      src={article.heroImageUrl}
                      alt={article.title}
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="mt-5">
                  <div className="flex items-center gap-3">
                    <span className="eyebrow text-muted-foreground">
                      {article.publishedAt
                        ? new Date(article.publishedAt).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "Draft"}
                    </span>
                    {article.visibility !== "public" && (
                      <StatusPill tone="muted">
                        {article.visibility === "registered" ? "Account" : "Members"}
                      </StatusPill>
                    )}
                  </div>
                  <h2 className="mt-3 font-display text-xl font-bold leading-snug">
                    {article.title}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">{article.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
