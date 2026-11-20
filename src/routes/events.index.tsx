import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { listEvents } from "@/lib/public.functions";
import {
  EventCard,
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  PageHero,
  Section,
  SectionHeading,
} from "@/components/site/Bits";
import { useLanguage } from "@/contexts/LanguageContext";
import { trackEvent } from "@/lib/analytics";

export const Route = createFileRoute("/events/")({
  head: () => ({
    meta: [
      { title: "Events - CometX" },
      {
        name: "description",
        content:
          "The CometX calendar: the Annual Symposium, Beer POTLA.CH and regional networking evenings across Switzerland.",
      },
      { property: "og:title", content: "CometX events" },
      {
        property: "og:description",
        content: "Upcoming and past CometX events across Zurich, Geneva, Basel and Bern.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EventsPage,
});

function EventsPage() {
  const { language } = useLanguage();
  const cs = language === "cs";
  const fetchEvents = useServerFn(listEvents);
  const { data, isLoading, error } = useQuery({
    queryKey: ["events"],
    queryFn: () => fetchEvents(),
  });
  const [place, setPlace] = useState("all");
  const [year, setYear] = useState("all");
  const allEvents = useMemo(
    () => (data ? [...data.featured, ...data.upcoming, ...data.past] : []),
    [data],
  );
  const places = useMemo(
    () =>
      Array.from(
        new Set(
          allEvents
            .map((event) => (!cs && event.venue_en?.trim() ? event.venue_en : event.venue)?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [allEvents, cs],
  );
  const eventYear = (value: string) =>
    new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Europe/Zurich" }).format(
      new Date(value),
    );
  const years = useMemo(
    () =>
      Array.from(new Set(allEvents.map((event) => eventYear(event.start_date)))).sort((a, b) =>
        b.localeCompare(a),
      ),
    [allEvents],
  );
  const matchesFilter = <
    T extends { start_date: string; venue: string | null; venue_en?: string | null },
  >(
    event: T,
  ) => {
    const eventPlace = (!cs && event.venue_en?.trim() ? event.venue_en : event.venue)?.trim() ?? "";
    return (
      (place === "all" || eventPlace === place) &&
      (year === "all" || eventYear(event.start_date) === year)
    );
  };
  const featuredEvents = data?.featured.filter(matchesFilter) ?? [];
  const upcomingEvents = data?.upcoming.filter(matchesFilter) ?? [];
  const pastEvents = data?.past.filter(matchesFilter) ?? [];
  const listViewSent = useRef(false);
  useEffect(() => {
    if (!data || listViewSent.current) return;
    listViewSent.current = true;
    trackEvent("events_list_view", {
      event_count: new Set(
        [...data.featured, ...data.upcoming, ...data.past].map((event) => event.slug),
      ).size,
    });
  }, [data]);

  return (
    <>
      <PageHero
        tone="brand"
        eyebrow={cs ? "Kalendář" : "Calendar"}
        title={cs ? "Objevte akce CometX" : "Discover CometX events"}
        lead={
          cs
            ? "Výroční sympozium, odborné workshopy, debaty Beer POTLA.CH a volnočasová setkání, ze kterých vznikají trvalá spojení."
            : "Annual Symposium, expert-led workshops, Beer POTLA.CH debates and leisure activities for building lasting connections."
        }
      />

      <Section>
        {isLoading && <LoadingBlock label={cs ? "Načítáme akce" : "Loading events"} />}
        {error && <ErrorBlock error={error} />}

        {data && (
          <div className="mb-12 grid gap-4 rounded-[1.5rem] bg-paper p-5 sm:grid-cols-2 sm:p-6">
            <label className="grid gap-2 text-sm font-bold">
              {cs ? "Místo konání" : "Location"}
              <select
                value={place}
                onChange={(event) => setPlace(event.target.value)}
                className="min-h-12 rounded-xl border border-input bg-background px-4 font-normal"
              >
                <option value="all">{cs ? "Všechna místa" : "All locations"}</option>
                {places.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold">
              {cs ? "Rok" : "Year"}
              <select
                value={year}
                onChange={(event) => setYear(event.target.value)}
                className="min-h-12 rounded-xl border border-input bg-background px-4 font-normal"
              >
                <option value="all">{cs ? "Všechny roky" : "All years"}</option>
                {years.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {data && (
          <>
            {featuredEvents.length > 0 && (
              <>
                <SectionHeading
                  eyebrow={cs ? "Akce roku" : "Event of the year"}
                  title={cs ? "Výroční sympozium" : "Annual Symposium"}
                />
                <div className="mb-20 grid gap-6 md:grid-cols-3">
                  {featuredEvents.map((event) => (
                    <EventCard key={event.slug} event={event} />
                  ))}
                </div>
              </>
            )}

            <SectionHeading
              eyebrow={cs ? "Co nás čeká" : "Next up"}
              title={cs ? "Nadcházející" : "Upcoming"}
            />
            {upcomingEvents.length === 0 ? (
              <EmptyBlock
                title={cs ? "Právě nejsou naplánované žádné akce" : "Nothing scheduled right now"}
                hint={
                  cs ? "Nové termíny zveřejňujeme každý měsíc." : "New dates are published monthly."
                }
              />
            ) : (
              <div className="grid gap-6 md:grid-cols-3">
                {upcomingEvents.map((event) => (
                  <EventCard key={event.slug} event={event} />
                ))}
              </div>
            )}

            <div className="mt-20">
              <SectionHeading
                eyebrow={cs ? "Z historie" : "Selected history"}
                title={cs ? "Minulé akce" : "Past highlights"}
              />
              {pastEvents.length === 0 ? (
                <EmptyBlock title={cs ? "Zatím žádné minulé akce" : "No past events yet"} />
              ) : (
                <div className="grid gap-6 md:grid-cols-3">
                  {pastEvents.map((event) => (
                    <EventCard key={event.slug} event={event} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </Section>
    </>
  );
}
