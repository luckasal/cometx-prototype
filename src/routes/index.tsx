import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowRight, MapPin } from "lucide-react";
import { getHomeData, listPartners } from "@/lib/public.functions";
import { Button } from "@/components/ui/button";
import { EmptyBlock, ErrorBlock, LoadingBlock, Section, StatusPill } from "@/components/site/Bits";
import { formatMoney } from "@/lib/pricing";
import { useLanguage } from "@/contexts/LanguageContext";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

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

type HomeEvent = {
  title: string;
  title_en?: string | null;
  slug: string;
  start_date: string;
  venue: string | null;
  venue_en?: string | null;
  status: string;
};

function localized(cs: boolean, value: string | null | undefined, valueEn: string | null | undefined) {
  return !cs && valueEn?.trim() ? valueEn : value;
}

function Home() {
  const { language } = useLanguage();
  const cs = language === "cs";
  const fetchHome = useServerFn(getHomeData);
  const { data, isLoading, error } = useQuery({ queryKey: ["home"], queryFn: () => fetchHome() });
  const nextEvent = data?.upcoming[0];

  return (
    <>
      {/* HERO: dark CometX community image panel, with light content sections below */}
      <section className="relative min-h-[38rem] overflow-hidden bg-ink text-ink-foreground lg:min-h-[min(60rem,82svh)]">
        <img
          src="/assets/cometx/article-november.jpg"
          alt=""
          aria-hidden
          className="brand-photo pointer-events-none absolute inset-0 size-full object-[center_65%] opacity-35 lg:left-auto lg:w-[60%] lg:opacity-100 lg:[clip-path:polygon(35%_0,100%_0,100%_100%,0_100%)]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/40 lg:hidden" />
        <div className="relative mx-auto flex min-h-[38rem] max-w-7xl items-center px-5 py-20 pb-28 lg:min-h-[min(60rem,82svh)] lg:px-8 lg:py-28 lg:pb-32">
          <div className="max-w-xl">
            <h1 className="display-xl">
              {cs ? "Profesionální síť kontaktů s kouskem domova" : "Your professional network with a piece of home"}
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-ink-foreground/85">
              {cs
                ? "Akce, networking a adresář Čechů a Slováků ve Švýcarsku. Pro studenty, profesionály, podnikatele i ty, kdo se vracejí domů."
                : "Events, networking and a directory for Czechs and Slovaks in Switzerland. For students, professionals, entrepreneurs and those finding their way home."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="signal" size="xl">
                <Link
                  to="/membership"
                  data-analytics-cta="join_membership_home_hero"
                  onClick={() => trackEvent("membership_cta_click", { placement: "home_hero" })}
                >
                  {cs ? "Staň se členem" : "Become a member"}
                </Link>
              </Button>
              <Button asChild variant="outlineLight" size="xl">
                <Link to="/events" data-analytics-cta="view_events_home_hero">
                  {cs ? "Nadcházející akce" : "Upcoming events"}
                </Link>
              </Button>
            </div>
            {nextEvent && (
              <Link
                to="/events/$slug"
                params={{ slug: nextEvent.slug }}
                data-analytics-cta="next_event_home_hero"
                className="mt-6 inline-flex max-w-full items-center gap-3 rounded-full bg-ink-foreground/10 px-4 py-2 text-sm transition-colors hover:bg-ink-foreground/15"
              >
                <span className="shrink-0 font-bold text-accent">{cs ? "Nejbližší akce" : "Next event"}</span>
                <span className="truncate text-ink-foreground/85">
                  {formatShortDate(nextEvent.start_date, cs)}
                  {localized(cs, nextEvent.venue, nextEvent.venue_en) ? ` · ${localized(cs, nextEvent.venue, nextEvent.venue_en)}` : ""}
                  {` · ${localized(cs, nextEvent.title, nextEvent.title_en)}`}
                </span>
                <ArrowRight className="size-4 shrink-0" />
              </Link>
            )}
          </div>
        </div>
        <a
          href="#upcoming-events"
          className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center rounded-full bg-ink/70 px-5 py-2 text-sm font-semibold text-ink-foreground backdrop-blur transition-colors hover:bg-ink"
        >
          {cs ? "Posuň dolů" : "Scroll down"}
          <span className="mt-1 grid size-7 place-items-center rounded-b-full bg-accent text-accent-foreground">
            <ArrowDown className="size-4" aria-hidden="true" />
          </span>
        </a>
      </section>

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
          {/* UPCOMING */}
          <Section>
            <h2 id="upcoming-events" className="display-lg">{cs ? "Nadcházející akce" : "Upcoming events"}</h2>
            {data.upcoming.length === 0 ? (
              <div className="mt-8">
                <EmptyBlock
                  title={cs ? "Zatím nejsou naplánované žádné akce" : "No events scheduled yet"}
                  hint={cs ? "Brzy se vraťte." : "Check back shortly."}
                />
              </div>
            ) : (
              <div className="mt-8 grid gap-5 md:grid-cols-3">
                {data.upcoming.map((event) => (
                  <UpcomingCard key={event.slug} event={event} cs={cs} />
                ))}
              </div>
            )}
            <div className="mt-8 flex justify-center">
              <Button asChild variant="signal" size="lg">
                <Link to="/events" data-analytics-cta="all_events_home">
                  {cs ? "Všechny akce" : "All events"}
                </Link>
              </Button>
            </div>
          </Section>

          {/* FLAGSHIP + FACTS: dark/lime split band */}
          <section className="relative overflow-hidden bg-accent text-accent-foreground">
            <div className="absolute inset-y-0 left-0 hidden w-1/2 bg-ink lg:block lg:[clip-path:polygon(0_0,100%_0,82%_100%,0_100%)]" />
            <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-16 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-24">
              {data.featured ? (
                <Link
                  to="/events/$slug"
                  params={{ slug: data.featured.slug }}
                  data-analytics-cta="featured_event_home"
                  className="group block overflow-hidden rounded-3xl bg-ink text-ink-foreground"
                >
                  <div className="aspect-[16/10] overflow-hidden bg-ink-foreground/10">
                    {data.featured.hero_image_url && (
                      <img
                        src={data.featured.hero_image_url}
                        alt={localized(cs, data.featured.title, data.featured.title_en) ?? ""}
                        className="brand-photo size-full transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    )}
                  </div>
                  <div className="p-6">
                    <StatusPill tone="signal">{cs ? "Hlavní akce" : "Flagship event"}</StatusPill>
                    <h3 className="mt-3 font-display text-xl font-bold">
                      {localized(cs, data.featured.title, data.featured.title_en)}
                    </h3>
                    <p className="mt-1 text-sm text-ink-foreground/65">
                      {formatLongDate(data.featured.start_date, cs)}
                      {localized(cs, data.featured.venue, data.featured.venue_en)
                        ? ` · ${localized(cs, data.featured.venue, data.featured.venue_en)}`
                        : ""}
                    </p>
                  </div>
                </Link>
              ) : (
                <div className="hidden lg:block" />
              )}
              <div>
                <h2 className="display-lg">{cs ? "Profesní růst mezi svými" : "Professional growth among your own"}</h2>
                <dl className="mt-8 grid grid-cols-3 gap-6">
                  {[
                    [cs ? "Od 2021" : "Since 2021", cs ? "švýcarská neziskovka" : "a Swiss nonprofit"],
                    ["200+", cs ? "hostů sympozia" : "symposium guests"],
                    ["4", cs ? "formáty akcí" : "event formats"],
                  ].map(([value, label]) => (
                    <div key={label}>
                      <dt className="font-display text-2xl font-extrabold sm:text-3xl">{value}</dt>
                      <dd className="mt-1 text-sm">{label}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-8">
                  <Button asChild size="lg" className="bg-ink font-semibold text-ink-foreground hover:bg-ink/90 hover:brightness-100">
                    <Link to="/events" data-analytics-cta="events_home_growth">
                      {cs ? "Program akcí" : "Event programme"} <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* MISSION */}
          <Section className="pb-0 lg:pb-0">
            <div className="grid gap-10 rounded-3xl bg-secondary p-8 lg:grid-cols-[0.8fr_1.2fr] lg:p-12">
              <h2 className="display-lg">{cs ? "Poslání CometX" : "The CometX mission"}</h2>
              <div className="grid gap-8 sm:grid-cols-3">
                {[
                  [
                    cs ? "Kalendář" : "A calendar",
                    cs
                      ? "Výroční sympozium, Beer POTLA.CH, odborné workshopy a pohodová venkovní setkání."
                      : "Annual Symposium, Beer POTLA.CH, focused workshops and relaxed outdoor gatherings.",
                  ],
                  [
                    cs ? "Členství" : "A membership",
                    cs
                      ? "Členstvím podpoříte neziskovku a získáte členský obsah, nabídky akcí a komunitní výhody."
                      : "Membership supports the nonprofit and opens member content, event offers and community benefits.",
                  ],
                  [
                    cs ? "Síť" : "A network",
                    cs
                      ? "Most mezi českými a slovenskými krajany, institucemi, firmami, akademickou sférou a průmyslem."
                      : "A bridge between Czech and Slovak expats, institutions, companies, academia and industry.",
                  ],
                ].map(([title, text]) => (
                  <div key={title} className="border-t border-ink/15 pt-5">
                    <h3 className="font-display text-lg font-bold">{title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* COMMUNITY STORIES */}
          {data.articles.length > 0 && (
            <Section>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h2 className="display-lg">{cs ? "Příběhy z naší sítě" : "Stories from the network"}</h2>
                <Button asChild variant="outline" size="sm" className="rounded-full">
                  <Link to="/community">{cs ? "Všechny příběhy" : "All stories"}</Link>
                </Button>
              </div>
              <div className="mt-8 grid gap-5 md:grid-cols-3">
                {data.articles.map((article) => (
                  <Link
                    key={article.slug}
                    to="/community/articles/$slug"
                    params={{ slug: article.slug }}
                    className="group overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-ink/30"
                  >
                    <div className="aspect-[16/9] overflow-hidden bg-muted">
                      {article.hero_image_url && (
                        <img
                          src={article.hero_image_url}
                          alt={localized(cs, article.title, article.title_en) ?? ""}
                          className="brand-photo size-full transition-transform duration-500 group-hover:scale-[1.03]"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <div className="p-5">
                      {article.visibility !== "public" && <StatusPill tone="muted">{cs ? "Pro členy" : "Members"}</StatusPill>}
                      <h3 className="mt-2 font-display text-lg font-bold leading-snug">
                        {localized(cs, article.title, article.title_en)}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {localized(cs, article.excerpt, article.excerpt_en)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {/* MEMBERSHIP + PARTNERS on a cloud-white band, opened by the lime chevron */}
          <div aria-hidden className="relative h-16 bg-accent lg:h-20">
            <div className="absolute inset-x-0 bottom-0 mx-auto h-full w-16 bg-background [clip-path:polygon(0_0,100%_0,50%_100%)] lg:w-20" />
          </div>
          <section className="-mb-24 bg-secondary">
            <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
              <h2 className="display-lg text-center">{cs ? "Staňte se členem" : "Become a member"}</h2>
              <div className="mt-10 grid gap-5 md:grid-cols-3">
                {data.plans.map((plan) => (
                  <div key={plan.slug} className="flex flex-col rounded-3xl bg-card p-7">
                    <h3 className="font-display text-xl font-bold">{localized(cs, plan.name, plan.name_en)}</h3>
                    <p className="mt-3 font-display text-3xl font-extrabold">
                      {formatMoney(Number(plan.annual_price), plan.currency)}
                      <span className="text-sm font-normal text-muted-foreground"> {cs ? "/ rok" : "/ year"}</span>
                    </p>
                    <p className="mt-3 flex-1 text-sm text-muted-foreground">
                      {localized(cs, plan.description, plan.description_en)}
                    </p>
                    <Button asChild variant="outline" size="lg" className="mt-6 rounded-full">
                      <Link
                        to="/membership"
                        data-analytics-cta={`home_plan_${plan.slug}`}
                        onClick={() => trackEvent("membership_cta_click", { placement: "home_plans", plan: plan.slug })}
                      >
                        {cs ? `Vybrat ${plan.name}` : `Choose ${plan.name_en?.trim() || plan.name}`}
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex justify-center">
                <Button asChild variant="signal" size="lg">
                  <Link
                    to="/membership"
                    data-analytics-cta="compare_membership_home"
                    onClick={() => trackEvent("membership_cta_click", { placement: "home_plans" })}
                  >
                    {cs ? "Porovnat výhody" : "Compare benefits"}
                  </Link>
                </Button>
              </div>

              <HomePartners cs={cs} />
            </div>
          </section>
        </>
      )}
    </>
  );
}

function UpcomingCard({ event, cs }: { event: HomeEvent; cs: boolean }) {
  const date = new Date(event.start_date);
  const venue = localized(cs, event.venue, event.venue_en);
  const locale = cs ? "cs-CZ" : "en-GB";
  return (
    <Link
      to="/events/$slug"
      params={{ slug: event.slug }}
      data-analytics-cta={`event_card_${event.slug}`}
      className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-ink/30"
    >
      <div className="flex items-start gap-3">
        <div className="grid min-w-14 place-items-center rounded-xl bg-ink px-2 py-2 text-ink-foreground">
          <span className="font-display text-2xl font-extrabold leading-none text-accent">{date.getDate()}</span>
          <span className="mt-1 text-[11px] leading-none">
            {date.toLocaleDateString(locale, { month: "short", year: "numeric" })}
          </span>
        </div>
        <div className="min-w-0 space-y-1.5">
          {venue && (
            <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{venue}</span>
            </span>
          )}
          <p className="text-sm text-muted-foreground">
            {date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>
      <h3 className="font-display text-lg font-bold leading-snug group-hover:underline group-hover:underline-offset-4">
        {localized(cs, event.title, event.title_en)}
      </h3>
      {event.status === "registration_open" && (
        <div>
          <StatusPill tone="signal">{cs ? "V prodeji" : "Open"}</StatusPill>
        </div>
      )}
      {event.status === "sold_out" && (
        <div>
          <StatusPill tone="muted">{cs ? "Vyprodáno" : "Sold out"}</StatusPill>
        </div>
      )}
    </Link>
  );
}

function HomePartners({ cs }: { cs: boolean }) {
  const fetchPartners = useServerFn(listPartners);
  // Same query key as /partners so the data is shared between the pages.
  const { data } = useQuery({ queryKey: ["partners"], queryFn: () => fetchPartners() });
  const groups = useMemo(() => {
    const map = new Map<string, NonNullable<typeof data>>();
    for (const partner of data ?? []) {
      const key = partner.tier?.trim() || "";
      map.set(key, [...(map.get(key) ?? []), partner]);
    }
    return [...map.entries()];
  }, [data]);
  const [active, setActive] = useState<string | null>(null);
  const current = groups.find(([tier]) => tier === active) ?? groups[0];
  if (!current) return null;

  return (
    <div className="mt-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="font-display text-2xl font-bold">{cs ? "Partneři" : "Partners"}</h3>
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link to="/partners">{cs ? "Všichni partneři" : "All partners"}</Link>
        </Button>
      </div>
      {groups.length > 1 && (
        <div className="mt-5 flex flex-wrap gap-2" role="tablist">
          {groups.map(([tier, partners]) => (
            <button
              key={tier || "other"}
              type="button"
              role="tab"
              aria-selected={tier === current[0]}
              onClick={() => setActive(tier)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-bold transition-colors",
                tier === current[0]
                  ? "border-ink bg-ink text-ink-foreground"
                  : "border-border bg-card hover:border-ink/40",
              )}
            >
              {tier || (cs ? "Další partneři" : "Other partners")}{" "}
              <span className={tier === current[0] ? "text-accent" : "text-muted-foreground"}>({partners.length})</span>
            </button>
          ))}
        </div>
      )}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {current[1].map((partner) => {
          const tile = partner.logo_url ? (
            <img src={partner.logo_url} alt={partner.name} className="max-h-14 w-auto max-w-full object-contain" loading="lazy" />
          ) : (
            <span className="text-center font-display text-sm font-bold text-muted-foreground">{partner.name}</span>
          );
          const className = "grid h-24 place-items-center rounded-2xl bg-card p-4";
          return partner.website_url ? (
            <a
              key={partner.id}
              href={partner.website_url}
              target="_blank"
              rel="noreferrer noopener"
              className={cn(className, "transition-shadow hover:shadow-md")}
              title={partner.name}
            >
              {tile}
            </a>
          ) : (
            <div key={partner.id} className={className} title={partner.name}>
              {tile}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatShortDate(value: string, cs: boolean) {
  return new Date(value).toLocaleDateString(cs ? "cs-CZ" : "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

function formatLongDate(value: string, cs: boolean) {
  return new Date(value).toLocaleDateString(cs ? "cs-CZ" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
