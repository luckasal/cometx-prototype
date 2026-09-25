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
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { language } = useLanguage();
  const cs = language === "cs";
  const fetchArticles = useServerFn(listArticles);
  const { data, isLoading, error } = useQuery({
    queryKey: ["articles"],
    queryFn: () => fetchArticles(),
  });

  return (
    <>
      <PageHero
        eyebrow={cs ? "Komunita" : "Community"}
        title={cs ? "Názory, reportáže a život krajanů ve Švýcarsku" : "Opinions, reports and Swiss expat life"}
        lead={cs ? "Příběhy z akcí CometX a od lidí, kteří ve Švýcarsku propojují vědu, byznys, diplomacii a komunitu." : "Stories from CometX events and the people connecting science, business, diplomacy and community across Switzerland."}
      />
      <Section>
        {isLoading && <LoadingBlock label={cs ? "Načítáme příběhy" : "Loading stories"} />}
        {error && <ErrorBlock error={error} />}
        {data && data.length === 0 && <EmptyBlock title={cs ? "Zatím nebyly publikovány žádné příběhy" : "No stories published yet"} />}
        {data && data.length > 0 && (
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
            {data.map((article) => (
              <Link
                key={article.slug}
                to="/community/articles/$slug"
                params={{ slug: article.slug }}
                className="group flex flex-col"
              >
                <div className="aspect-[16/10] overflow-hidden rounded-3xl bg-muted">
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
                        ? new Date(article.publishedAt).toLocaleDateString(cs ? "cs-CZ" : "en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : cs ? "Koncept" : "Draft"}
                    </span>
                    {article.visibility !== "public" && (
                      <StatusPill tone="muted">
                        {article.visibility === "registered" ? (cs ? "S účtem" : "Account") : (cs ? "Pro členy" : "Members")}
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
      <section className="border-y border-border bg-paper">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { title: cs ? "Celá videa" : "Full videos", text: cs ? "Přednášky a rozhovory z akcí CometX na našem YouTube kanálu." : "Talks and interviews from CometX events on our YouTube channel.", href: "https://www.youtube.com/@cometx" },
              { title: cs ? "Fotogalerie" : "Gallery", text: cs ? "Atmosféra, setkání a nezapomenutelné momenty z minulých akcí." : "Atmosphere, encounters and memorable moments from previous events.", href: "https://www.cometx.ch/gallery" },
              { title: cs ? "Názory komunity" : "Community opinions", text: cs ? "Skutečné zkušenosti a názory lidí, kteří tvoří CometX." : "Real experiences and opinions from the people who make CometX.", href: "https://www.cometx.ch/opinions" },
            ].map((item) => (
              <a key={item.title} href={item.href} target="_blank" rel="noreferrer noopener" className="group overflow-hidden rounded-2xl border border-border/60 bg-background p-7">
                <h2 className="font-display text-xl font-bold group-hover:underline">{item.title}</h2>
                <p className="mt-3 text-sm text-muted-foreground">{item.text}</p>
              </a>
            ))}
          </div>
        </div>
      </section>
      <section className="bg-accent text-accent-foreground">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 md:grid-cols-2 lg:px-8">
          <div>
            <h2 className="font-display text-2xl font-extrabold">{cs ? "Připojte se k WhatsApp komunitě" : "Join the WhatsApp community"}</h2>
            <p className="mt-2 text-sm">{cs ? "Nové kontakty, sdílené zkušenosti a aktuální dění na jednom místě." : "New contacts, shared experiences and current community news in one place."}</p>
            <a href="https://chat.whatsapp.com/DczHatSCHRSADY6phvkdfe" target="_blank" rel="noreferrer noopener" className="mt-5 inline-flex bg-ink px-5 py-3 text-sm font-bold text-ink-foreground">WhatsApp</a>
          </div>
          <div>
            <h2 className="font-display text-2xl font-extrabold">{cs ? "CometX newsletter" : "CometX newsletter"}</h2>
            <p className="mt-2 text-sm">{cs ? "Nové akce, nové kontakty, nová perspektiva. Přihlášení zatím dokončíte na oficiálním webu CometX." : "New events, new contacts, new perspective. For now, complete signup on the official CometX website."}</p>
            <a href="https://www.cometx.ch/" target="_blank" rel="noreferrer noopener" className="mt-5 inline-flex rounded-full border border-ink px-5 py-3 text-sm font-bold">{cs ? "Přihlásit newsletter" : "Subscribe"}</a>
          </div>
        </div>
      </section>
    </>
  );
}
