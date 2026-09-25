import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight } from "lucide-react";
import { getHomeData } from "@/lib/public.functions";
import { Button } from "@/components/ui/button";
import {
  EventCard,
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  Section,
  SectionHeading,
  StatusPill,
} from "@/components/site/Bits";
import { formatMoney } from "@/lib/pricing";
import heroImage from "@/assets/hero-symposium.jpg";
import { useLanguage } from "@/contexts/LanguageContext";
import { BrandXElement } from "@/components/site/BrandXElement";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CometX - Czech & Slovak professionals in Switzerland" },
      {
        name: "description",
        content:
          "Events, membership and a working network for Czech and Slovak professionals living in Switzerland.",
      },
      { property: "og:title", content: "CometX - the community in Switzerland" },
      {
        property: "og:description",
        content:
          "Annual Symposium, Beer POTLA.CH and a membership that pays for the room. Join CometX.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { language } = useLanguage();
  const cs = language === "cs";
  const fetchHome = useServerFn(getHomeData);
  const { data, isLoading, error } = useQuery({ queryKey: ["home"], queryFn: () => fetchHome() });

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-ink text-ink-foreground">
        <BrandXElement className="absolute -right-24 -top-48 h-[42rem] w-auto opacity-20 lg:-right-12 lg:-top-40" />
        <img
          src={heroImage}
          alt=""
          aria-hidden
          className="brand-photo pointer-events-none absolute inset-0 size-full opacity-25"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/40" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:px-8 lg:py-32">
          <div>
            <p className="eyebrow text-accent">{cs ? "Networking · Komunita · Debaty · Konference" : "Networking · Community · Debates · Conferences"}</p>
            <h1 className="display-xl mt-6">
              {cs ? "Vaše profesní síť s dotekem domova" : "Your professional network with a touch of homeland"}
            </h1>
            <p className="mt-8 max-w-xl text-lg text-ink-foreground/70">
              {cs ? "CometX je švýcarská nezisková organizace pořádající vzdělávací a společenské akce pro české a slovenské krajany. Propojujeme akademickou sféru s průmyslem a stavíme mosty mezi znalostmi, talenty a nápady." : "CometX is a Swiss nonprofit creating educational and social events for Czech and Slovak expats. We connect academia with industry and build bridges of knowledge, talent and ideas."}
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild variant="signal" size="xl">
                <Link to="/membership">{cs ? "Přidejte se ke CometX" : "Join CometX"}</Link>
              </Button>
              <Button asChild variant="outlineLight" size="xl">
                <Link to="/events">{cs ? "Nadcházející akce" : "See upcoming events"}</Link>
              </Button>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-6 border-t border-ink-foreground/15 pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            {[
              [cs ? "Od roku 2021" : "Since 2021", cs ? "švýcarská neziskovka" : "a Swiss nonprofit"],
              ["200+", cs ? "hostů sympozia" : "symposium guests"],
              ["4", cs ? "formáty akcí" : "event formats"],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="font-display text-3xl font-extrabold text-accent">{value}</dt>
                <dd className="mt-1 text-xs text-ink-foreground/60">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <div className="brand-divider" aria-hidden="true"><BrandXElement variant="fullDark" className="brand-divider-art" /></div>

      {isLoading && (
        <Section>
          <LoadingBlock label={cs ? "Načítáme komunitu" : "Loading the community"} />
        </Section>
      )}
      {error && (
        <Section>
          <ErrorBlock error={error} />
        </Section>
      )}

      {data && (
        <>
          {/* FEATURED SYMPOSIUM */}
          {data.featured && (
            <Section>
              <div className="grid gap-10 overflow-hidden rounded-2xl border border-border/60 bg-card lg:grid-cols-2">
                <div className="min-h-[320px] bg-muted">
                  {data.featured.hero_image_url && (
                    <img
                      src={data.featured.hero_image_url}
                      alt={data.featured.title}
                      className="brand-photo size-full"
                    />
                  )}
                </div>
                <div className="flex flex-col justify-center p-8 lg:p-12">
                  <StatusPill tone="signal">{cs ? "Hlavní akce" : "Flagship event"}</StatusPill>
                  <h2 className="display-lg mt-5">{data.featured.title}</h2>
                   <p className="mt-4 text-muted-foreground">{data.featured.short_description}</p>
                  <p className="mt-6 text-sm text-muted-foreground">
                    {new Date(data.featured.start_date).toLocaleDateString(cs ? "cs-CZ" : "en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    {data.featured.venue ? ` - ${data.featured.venue}` : ""}
                  </p>
                  <div className="mt-8">
                    <Button asChild variant="ink" size="lg">
                      <Link to="/events/$slug" params={{ slug: data.featured.slug }}>
                        {cs ? "Vstupenky a program" : "Tickets and programme"} <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </Section>
          )}

          {/* UPCOMING */}
          <Section className="pt-0">
            <SectionHeading
              eyebrow={cs ? "Kalendář" : "Calendar"}
              title={cs ? "Nadcházející akce" : "Upcoming events"}
              action={
                <Link to="/events" className="text-sm font-medium underline underline-offset-4">
                  {cs ? "Všechny akce" : "All events"}
                </Link>
              }
            />
            {data.upcoming.length === 0 ? (
              <EmptyBlock title={cs ? "Zatím nejsou naplánované žádné akce" : "No events scheduled yet"} hint={cs ? "Brzy se vraťte." : "Check back shortly."} />
            ) : (
              <div className="grid gap-6 md:grid-cols-3">
                {data.upcoming.map((event) => (
                  <EventCard key={event.slug} event={event} />
                ))}
              </div>
            )}
          </Section>

          {/* WHAT COMETX IS */}
          <section className="border-y border-border bg-paper">
            <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
               <h2 className="display-lg">{cs ? "Poslání CometX" : "The CometX mission"}</h2>
              <div className="grid gap-8 sm:grid-cols-3">
                {[
                  [
                    cs ? "Kalendář" : "A calendar",
                    cs ? "Výroční sympozium, Beer POTLA.CH, odborné workshopy a pohodová venkovní setkání." : "Annual Symposium, Beer POTLA.CH, focused workshops and relaxed outdoor gatherings.",
                  ],
                  [
                    cs ? "Členství" : "A membership",
                    cs ? "Členstvím podpoříte neziskovku a získáte členský obsah, nabídky akcí a komunitní výhody." : "Membership supports the nonprofit and opens member content, event offers and community benefits.",
                  ],
                  [
                    cs ? "Síť" : "A network",
                    cs ? "Most mezi českými a slovenskými krajany, institucemi, firmami, akademickou sférou a průmyslem." : "A bridge between Czech and Slovak expats, institutions, companies, academia and industry.",
                  ],
                ].map(([title, text]) => (
                  <div key={title} className="rule-top pt-5">
                    <h3 className="font-display text-lg font-bold">{title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* MEMBERSHIP */}
          <Section>
            <SectionHeading eyebrow={cs ? "Členství" : "Membership"} title={cs ? "Tři možnosti, jak být součástí" : "Three ways to be part of it"} />
            <div className="grid gap-6 md:grid-cols-3">
              {data.plans.map((plan) => (
                <div key={plan.slug} className="flex flex-col rounded-3xl border border-border/60 p-8">
                  <h3 className="font-display text-2xl font-extrabold">{plan.name}</h3>
                  <p className="mt-3 flex-1 text-sm text-muted-foreground">{plan.description}</p>
                  <p className="mt-6 font-display text-xl font-bold">
                    {formatMoney(Number(plan.annual_price), plan.currency)}
                    <span className="text-sm font-normal text-muted-foreground"> {cs ? "/ rok" : "/ year"}</span>
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <Button asChild variant="signal" size="lg">
                <Link to="/membership">{cs ? "Porovnat výhody" : "Compare benefits"}</Link>
              </Button>
            </div>
          </Section>

          {/* COMMUNITY CONTENT */}
          <Section className="pt-0">
            <SectionHeading
              eyebrow={cs ? "Komunita" : "Community"}
              title={cs ? "Příběhy z naší sítě" : "Stories from the network"}
              action={
                <Link to="/community" className="text-sm font-medium underline underline-offset-4">
                  {cs ? "Všechny příběhy" : "All stories"}
                </Link>
              }
            />
            <div className="grid gap-6 md:grid-cols-3">
              {data.articles.map((article) => (
                <Link
                  key={article.slug}
                  to="/community/articles/$slug"
                  params={{ slug: article.slug }}
                  className="group overflow-hidden rounded-2xl border border-border/60 bg-card"
                >
                  <div className="aspect-[16/9] overflow-hidden bg-muted">
                    {article.hero_image_url && (
                      <img
                        src={article.hero_image_url}
                        alt={article.title}
                        className="brand-photo size-full transition-transform duration-500 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <div className="p-6">
                    {article.visibility !== "public" && <StatusPill tone="muted">{cs ? "Pro členy" : "Members"}</StatusPill>}
                    <h3 className="mt-3 font-display text-lg font-bold leading-snug">
                      {article.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {article.excerpt}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </Section>

          {/* PARTNERS */}
          <section className="border-t border-border">
            <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
              <p className="eyebrow text-muted-foreground">{cs ? "S podporou" : "Supported by"}</p>
              <div className="mt-6 flex flex-wrap items-center gap-x-12 gap-y-5">
                {data.partners.map((partner) => (
                  <span
                    key={partner.name}
                    className="font-display text-lg font-bold text-muted-foreground"
                  >
                    {partner.name}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="bg-accent text-accent-foreground">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-8 px-5 py-16 lg:px-8">
              <h2 className="display-lg max-w-2xl">
                {cs ? "Přidejte se k lidem, kteří už vědí, jak na to." : "Join the people who already know how this works."}
              </h2>
              <Button asChild variant="ink" size="xl">
                <Link to="/membership">{cs ? "Stát se členem" : "Become a member"}</Link>
              </Button>
            </div>
          </section>
        </>
      )}
    </>
  );
}
