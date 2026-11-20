import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowRight, MapPin } from "lucide-react";
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
      {/* HERO: match the CometX prototype; content sections keep the light site theme */}
      <section
        aria-labelledby="home-hero-title"
        className="relative flex min-h-svh flex-col overflow-hidden bg-ink text-ink-foreground lg:items-center lg:justify-center"
      >
        <div className="relative h-[46svh] min-h-[280px] w-full lg:absolute lg:inset-y-0 lg:right-0 lg:h-full lg:w-[60%]">
          <img
            src="/assets/cometx/hero-community.jpg"
            alt={cs ? "Tým CometX Crew na schodech Univerzity v Curychu (UZH)" : "CometX Crew on the steps of the University of Zurich (UZH)"}
            fetchPriority="high"
            className="brand-photo size-full object-[60%_55%]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 lg:hidden"
            style={{ background: "linear-gradient(rgba(33,32,32,0.55),rgba(33,32,32,0) 22%)" }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 hidden lg:block"
            style={{ background: "linear-gradient(rgba(33,32,32,0.55),rgba(33,32,32,0) 22%)" }}
          />
        </div>
        <div
          aria-hidden="true"
          className="absolute bottom-0 left-[calc(40%-1px)] top-0 z-[1] hidden lg:flex"
        >
          <svg
            viewBox="46.6 0 53.4 156"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
            className="block h-full w-auto flex-none"
          >
            <path d="M46.6 0 L97.5 70.5 Q100 74 100 78 Q100 82 97.5 85.5 L46.6 156 Z" fill="#212020" />
          </svg>
        </div>
        <div className="relative z-[2] w-full px-5 pb-12 pt-8 lg:mx-auto lg:max-w-7xl lg:px-8 lg:pb-24 lg:pt-[120px]">
          <div className="flex max-w-none flex-col gap-6 lg:max-w-[520px]">
            <span className="self-start rounded-full bg-accent px-3 py-1.5 text-[13px] font-bold tracking-[0.04em] text-accent-foreground">
              Come and Meet Expats
            </span>
            <h1 id="home-hero-title" className="font-display text-[clamp(2.5rem,4.6vw,4.125rem)] font-bold leading-[1.03] tracking-[0.005em] text-ink-foreground">
              {cs ? "Vaše profesionální síť kontaktů s kouskem domova" : "Your professional network with a touch of home"}
            </h1>
            <p className="text-[clamp(1.0625rem,1.4vw,1.1875rem)] leading-[1.55] text-[#ECECEC]">
              {cs
                ? "Akce, networking a adresář Čechů a Slováků ve Švýcarsku. Pro studenty, profesionály, podnikatele i ty, kdo se vracejí domů."
                : "Events, networking and a directory for Czechs and Slovaks in Switzerland. For students, professionals, entrepreneurs and those returning home."}
            </p>
            <div className="flex flex-wrap items-center gap-3.5">
              <Button asChild variant="signal" size="xl" className="min-h-[52px] px-[26px] text-[17px]">
                <Link
                  to="/membership"
                  data-analytics-cta="join_membership_home_hero"
                  onClick={() => trackEvent("membership_cta_click", { placement: "home_hero" })}
                >
                  {cs ? "Staň se členem" : "Become a member"}
                </Link>
              </Button>
              <Button asChild variant="outlineLight" size="xl" className="min-h-[52px] border-[1.5px] border-white px-6 text-[17px]">
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
                className="inline-flex max-w-full self-start items-center gap-2.5 rounded-[14px] border border-[#3A3939] bg-[#2E2D2D] px-4 py-2.5 text-[15px] text-ink-foreground transition-colors hover:bg-[#383737]"
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
          aria-label={cs ? "Posunout na nadcházející akce" : "Scroll to upcoming events"}
          className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1 rounded-full bg-ink/75 px-3.5 py-2 text-[13px] font-semibold text-ink-foreground transition-colors hover:bg-ink"
        >
          {cs ? "Posuň dolů" : "Scroll down"}
          <svg width="34" height="22" viewBox="0 0 156 100" aria-hidden="true">
            <path d="M0 0 H156 V46.6 L85.5 97.5 Q82 100 78 100 Q74 100 70.5 97.5 L0 46.6 Z" fill="#E1F03C" />
          </svg>
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

          {/* PROOF BAND: prototype's media panel over a dark/lime split */}
          <section aria-labelledby="home-proof-title" className="relative overflow-hidden bg-accent text-accent-foreground">
            <div aria-hidden="true" className="absolute inset-y-0 left-0 hidden w-[46%] lg:flex">
              <div className="flex-1 bg-ink" />
              <svg viewBox="46.6 0 53.4 156" preserveAspectRatio="xMidYMid meet" className="-ml-px block h-full w-auto flex-none">
                <path d="M46.6 0 L97.5 70.5 Q100 74 100 78 Q100 82 97.5 85.5 L46.6 156 Z" fill="#212020" />
              </svg>
            </div>
            <div className="relative mx-auto grid max-w-[1200px] grid-cols-1 gap-12 px-6 py-14 min-[776px]:grid-cols-2 min-[776px]:items-center lg:py-24">
              <Link
                to="/community"
                data-analytics-cta="community_media_home"
                aria-label={cs ? "Prohlédnout fotky a videa z akcí CometX" : "Browse CometX event photos and videos"}
                className="group flex aspect-[16/10] flex-col items-center justify-center gap-3 rounded-3xl bg-[#3A3939] p-6 text-center text-[#BDBBB8] transition-colors hover:bg-[#333232] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true" className="shrink-0">
                  <circle cx="28" cy="28" r="27" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent" />
                  <path d="M23 18 L39 28 L23 38 Z" fill="currentColor" className="text-accent" />
                </svg>
                <span>{cs ? "Videa a fotografie z akcí CometX" : "CometX event videos and photos"}</span>
              </Link>
              <div className="flex min-w-0 flex-col gap-7">
                <h2 id="home-proof-title" className="font-display text-[clamp(2rem,3.2vw,2.75rem)] font-bold leading-tight">
                  {cs ? "Profesní růst mezi svými" : "Professional growth among your own"}
                </h2>
                <dl className="grid grid-cols-3 gap-4 sm:gap-5">
                  {[
                    ["3\u00a0000+", cs ? "lidí v komunitě" : "people in the community"],
                    ["250+", cs ? "každý rok na Symposiu" : "at each Symposium"],
                    ["5–6", cs ? "akcí ročně" : "events each year"],
                  ].map(([value, label]) => (
                    <div key={label} className="min-w-0">
                      <dt className="font-display text-[clamp(1.75rem,3vw,2.75rem)] font-extrabold leading-none">{value}</dt>
                      <dd className="mt-2 text-sm leading-snug">{label}</dd>
                    </div>
                  ))}
                </dl>
                <Button asChild size="lg" className="w-fit rounded-full border border-ink bg-background px-6 font-semibold text-ink hover:bg-background/90 hover:brightness-100">
                  <Link to="/community" data-analytics-cta="community_media_home_button">
                    {cs ? "Fotky a videa ze všech akcí" : "Photos and videos from all events"}
                  </Link>
                </Button>
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
