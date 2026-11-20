import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock } from "lucide-react";
import { getArticle } from "@/lib/articles.functions";
import { Button } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock, Prose, Section } from "@/components/site/Bits";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { language } = useLanguage();
  const cs = language === "cs";
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
        <LoadingBlock label={cs ? "Načítáme příběh" : "Loading story"} />
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
        <h1 className="display-lg">{cs ? "Příběh nebyl nalezen" : "Story not found"}</h1>
        <Link to="/community" className="mt-4 inline-block underline underline-offset-4">
          {cs ? "Zpět do komunity" : "Back to community"}
        </Link>
      </Section>
    );

  const { article, locked, lockReason } = data;
  const title = !cs && article.titleEn?.trim() ? article.titleEn : article.title;
  const excerpt = !cs && article.excerptEn?.trim() ? article.excerptEn : article.excerpt;
  const body = !cs && article.bodyEn?.trim() ? article.bodyEn : article.body;

  return (
    <article>
      <header className="relative overflow-hidden bg-ink text-ink-foreground">
        <div aria-hidden="true" className="absolute inset-y-0 right-0 w-2 bg-accent" />
        <div className="mx-auto max-w-4xl px-5 py-14 sm:py-16 lg:px-8 lg:py-24">
          <Link to="/community" className="eyebrow text-accent hover:underline">
            &larr; {cs ? "Komunita" : "Community"}
          </Link>
          <h1 className="mt-6 font-display text-[clamp(2.5rem,6vw,4.75rem)] font-extrabold leading-[1.02] tracking-tight text-ink-foreground">
            {title}
          </h1>
          {excerpt && (
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-ink-foreground/75">
              {excerpt}
            </p>
          )}
          <p className="mt-5 text-sm text-ink-foreground/55">
            {article.publishedAt
              ? new Date(article.publishedAt).toLocaleDateString(cs ? "cs-CZ" : "en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : ""}
          </p>
        </div>
      </header>

      {article.heroImageUrl && (
        <div className="mx-auto mt-10 max-w-5xl px-5">
          <img src={article.heroImageUrl} alt={title} className="w-full rounded-3xl object-cover" />
        </div>
      )}

      <div className="relative mx-auto max-w-3xl px-5 py-14">
        <Prose text={body} />

        {locked && (
          <>
            <div className="pointer-events-none absolute inset-x-0 bottom-32 h-40 bg-gradient-to-b from-transparent to-background" />
            <div className="relative mt-10 rounded-2xl border border-border/60 bg-paper p-8 text-center">
              <Lock className="mx-auto size-5" />
              <h2 className="mt-4 font-display text-2xl font-extrabold">
                {cs ? "Obsah pouze pro členy" : lockReason}
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
                {cs
                  ? "Členové mají přístup k celému archivu včetně placených průzkumů, záznamů sympozia a částí příběhů, které nezveřejňujeme pro všechny."
                  : "Members get the full archive: pay surveys, symposium recordings and the parts of these stories we do not publish openly."}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button asChild variant="signal" size="lg">
                  <Link to="/membership">
                    {cs ? "Přidejte se ke CometX a čtěte dál" : "Join CometX to continue reading"}
                  </Link>
                </Button>
                {!user && (
                  <Button asChild variant="outlineInk" size="lg">
                    <Link to="/login">{cs ? "Přihlásit se" : "Log in"}</Link>
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
