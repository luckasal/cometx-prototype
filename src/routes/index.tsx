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
  const fetchHome = useServerFn(getHomeData);
  const { data, isLoading, error } = useQuery({ queryKey: ["home"], queryFn: () => fetchHome() });

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-ink text-ink-foreground">
        <img
          src={heroImage}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 size-full object-cover opacity-25"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/40" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:px-8 lg:py-32">
          <div>
            <p className="eyebrow text-accent">Networking &middot; Community &middot; Debates &middot; Conferences</p>
            <h1 className="display-xl mt-6">
              Your professional network with a touch of homeland
            </h1>
            <p className="mt-8 max-w-xl text-lg text-ink-foreground/70">
              CometX is a Swiss nonprofit creating educational and social events for Czech and Slovak
              expats. We connect academia with industry and build bridges of knowledge, talent and ideas.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild variant="signal" size="xl">
                <Link to="/membership">Join CometX</Link>
              </Button>
              <Button asChild variant="outlineLight" size="xl">
                <Link to="/events">See upcoming events</Link>
              </Button>
              <Button asChild variant="outlineLight" size="xl">
                <Link to="/demo">Try the interactive demo</Link>
              </Button>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-6 border-t border-ink-foreground/15 pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            {[
              ["Since 2021", "a Swiss nonprofit"],
              ["200+", "symposium guests"],
              ["4", "event formats"],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="font-display text-3xl font-extrabold text-accent">{value}</dt>
                <dd className="mt-1 text-xs text-ink-foreground/60">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <div className="brush-divider" aria-hidden />

      {isLoading && (
        <Section>
          <LoadingBlock label="Loading the community" />
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
              <div className="grid gap-10 border border-border bg-card lg:grid-cols-2">
                <div className="min-h-[320px] bg-muted">
                  {data.featured.hero_image_url && (
                    <img
                      src={data.featured.hero_image_url}
                      alt={data.featured.title}
                      className="size-full object-cover"
                    />
                  )}
                </div>
                <div className="flex flex-col justify-center p-8 lg:p-12">
                  <StatusPill tone="signal">Flagship event</StatusPill>
                  <h2 className="display-lg mt-5">{data.featured.title}</h2>
                   <p className="mt-4 text-muted-foreground">{data.featured.short_description}</p>
                  <p className="mt-6 text-sm text-muted-foreground">
                    {new Date(data.featured.start_date).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    {data.featured.venue ? ` - ${data.featured.venue}` : ""}
                  </p>
                  <div className="mt-8">
                    <Button asChild variant="ink" size="lg">
                      <Link to="/events/$slug" params={{ slug: data.featured.slug }}>
                        Tickets and programme <ArrowRight className="size-4" />
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
              eyebrow="Calendar"
              title="Upcoming events"
              action={
                <Link to="/events" className="text-sm font-medium underline underline-offset-4">
                  All events
                </Link>
              }
            />
            {data.upcoming.length === 0 ? (
              <EmptyBlock title="No events scheduled yet" hint="Check back shortly." />
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
               <h2 className="display-lg">The CometX mission</h2>
              <div className="grid gap-8 sm:grid-cols-3">
                {[
                  [
                    "A calendar",
                    "Annual Symposium, Beer POTLA.CH, focused workshops and relaxed outdoor gatherings.",
                  ],
                  [
                    "A membership",
                    "Membership supports the nonprofit and opens member content, event offers and community benefits.",
                  ],
                  [
                    "A network",
                    "A bridge between Czech and Slovak expats, institutions, companies, academia and industry.",
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
            <SectionHeading eyebrow="Membership" title="Three ways to be part of it" />
            <div className="grid gap-6 md:grid-cols-3">
              {data.plans.map((plan) => (
                <div key={plan.slug} className="flex flex-col border border-border p-8">
                  <h3 className="font-display text-2xl font-extrabold">{plan.name}</h3>
                  <p className="mt-3 flex-1 text-sm text-muted-foreground">{plan.description}</p>
                  <p className="mt-6 font-display text-xl font-bold">
                    {formatMoney(Number(plan.annual_price), plan.currency)}
                    <span className="text-sm font-normal text-muted-foreground"> / year</span>
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <Button asChild variant="signal" size="lg">
                <Link to="/membership">Compare benefits</Link>
              </Button>
            </div>
          </Section>

          {/* COMMUNITY CONTENT */}
          <Section className="pt-0">
            <SectionHeading
              eyebrow="Community"
              title="Stories from the network"
              action={
                <Link to="/community" className="text-sm font-medium underline underline-offset-4">
                  All stories
                </Link>
              }
            />
            <div className="grid gap-6 md:grid-cols-3">
              {data.articles.map((article) => (
                <Link
                  key={article.slug}
                  to="/community/articles/$slug"
                  params={{ slug: article.slug }}
                  className="group border border-border bg-card"
                >
                  <div className="aspect-[16/9] overflow-hidden bg-muted">
                    {article.hero_image_url && (
                      <img
                        src={article.hero_image_url}
                        alt={article.title}
                        className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <div className="p-6">
                    {article.visibility !== "public" && <StatusPill tone="muted">Members</StatusPill>}
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
              <p className="eyebrow text-muted-foreground">Supported by</p>
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
                Join the people who already know how this works.
              </h2>
              <Button asChild variant="ink" size="xl">
                <Link to="/membership">Become a member</Link>
              </Button>
            </div>
          </section>
        </>
      )}
    </>
  );
}
