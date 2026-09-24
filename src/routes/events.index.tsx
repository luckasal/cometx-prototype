import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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

  return (
    <>
      <PageHero
        eyebrow={cs ? "Kalendář" : "Calendar"}
        title={cs ? "Objevte akce CometX" : "Discover CometX events"}
        lead={cs ? "Výroční sympozium, odborné workshopy, debaty Beer POTLA.CH a volnočasová setkání, ze kterých vznikají trvalá spojení." : "Annual Symposium, expert-led workshops, Beer POTLA.CH debates and leisure activities for building lasting connections."}
      />

      <Section>
        {isLoading && <LoadingBlock label={cs ? "Načítáme akce" : "Loading events"} />}
        {error && <ErrorBlock error={error} />}

        {data && (
          <>
            {data.featured.length > 0 && (
              <>
                <SectionHeading eyebrow={cs ? "Akce roku" : "Event of the year"} title={cs ? "Výroční sympozium" : "Annual Symposium"} />
                <div className="mb-20 grid gap-6 md:grid-cols-3">
                  {data.featured.map((event) => (
                    <EventCard key={event.slug} event={event} />
                  ))}
                </div>
              </>
            )}

            <SectionHeading eyebrow={cs ? "Co nás čeká" : "Next up"} title={cs ? "Nadcházející" : "Upcoming"} />
            {data.upcoming.length === 0 ? (
              <EmptyBlock title={cs ? "Právě nejsou naplánované žádné akce" : "Nothing scheduled right now"} hint={cs ? "Nové termíny zveřejňujeme každý měsíc." : "New dates are published monthly."} />
            ) : (
              <div className="grid gap-6 md:grid-cols-3">
                {data.upcoming.map((event) => (
                  <EventCard key={event.slug} event={event} />
                ))}
              </div>
            )}

            <div className="mt-20">
              <SectionHeading eyebrow={cs ? "Z historie" : "Selected history"} title={cs ? "Minulé akce" : "Past highlights"} />
              {data.past.length === 0 ? (
                <EmptyBlock title={cs ? "Zatím žádné minulé akce" : "No past events yet"} />
              ) : (
                <div className="grid gap-6 md:grid-cols-3">
                  {data.past.map((event) => (
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
