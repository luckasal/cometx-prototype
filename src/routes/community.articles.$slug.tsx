import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock } from "lucide-react";
import { getArticle } from "@/lib/articles.functions";
import { Button } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock, Prose, Section } from "@/components/site/Bits";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/community/articles/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} - CometX community` },
      { name: "description", content: "A story from the CometX community." },
      { property: "og:title", content: "CometX community story" },
      { property: "og:description", content: "A story from the CometX community." },
    ],
  }),
  component: ArticlePage,
});

function ArticlePage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const fetchArticle = useServerFn(getArticle);
  const { data, isLoading, error } = useQuery({
    queryKey: ["article", slug, user?.id ?? "guest"],
    queryFn: () => fetchArticle({ data: { slug } }),
  });

  if (isLoading)
    return (
      <Section>
        <LoadingBlock label="Loading story" />
      </Section>
    );
  if (error)
    return (
      <Section>
        <ErrorBlock error={error} />
      </Section>
    );
  if (!data)
    return (
      <Section>
        <h1 className="display-lg">Story not found</h1>
        <Link to="/community" className="mt-4 inline-block underline underline-offset-4">
          Back to community
        </Link>
      </Section>
    );

  const { article, locked, lockReason } = data;

  return (
    <article>
      <div className="mx-auto max-w-3xl px-5 pt-16 lg:pt-24">
        <Link to="/community" className="eyebrow text-muted-foreground hover:text-foreground">
          &larr; Community
        </Link>
        <h1 className="display-lg mt-6">{article.title}</h1>
        {article.excerpt && <p className="mt-5 text-lg text-muted-foreground">{article.excerpt}</p>}
        <p className="mt-5 text-xs text-muted-foreground">
          {article.publishedAt
            ? new Date(article.publishedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : ""}
        </p>
      </div>

      {article.heroImageUrl && (
        <div className="mx-auto mt-10 max-w-5xl px-5">
          <img src={article.heroImageUrl} alt={article.title} className="w-full rounded-3xl object-cover" />
        </div>
      )}

      <div className="relative mx-auto max-w-3xl px-5 py-14">
        <Prose text={article.body} />

        {locked && (
          <>
            <div className="pointer-events-none absolute inset-x-0 bottom-32 h-40 bg-gradient-to-b from-transparent to-background" />
            <div className="relative mt-10 rounded-2xl border border-border/60 bg-paper p-8 text-center">
              <Lock className="mx-auto size-5" />
              <h2 className="mt-4 font-display text-2xl font-extrabold">{lockReason}</h2>
              <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
                Members get the full archive: pay surveys, symposium recordings and the parts of
                these stories we do not publish openly.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button asChild variant="signal" size="lg">
                  <Link to="/membership">Join CometX to continue reading</Link>
                </Button>
                {!user && (
                  <Button asChild variant="outlineInk" size="lg">
                    <Link to="/login">Log in</Link>
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </article>
  );
}
