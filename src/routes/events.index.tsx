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
  const fetchEvents = useServerFn(listEvents);
  const { data, isLoading, error } = useQuery({
    queryKey: ["events"],
    queryFn: () => fetchEvents(),
  });

  return (
    <>
      <PageHero
        eyebrow="Calendar"
        title="Discover CometX events"
        lead="Annual Symposium, expert-led workshops, Beer POTLA.CH debates and leisure activities for building lasting connections."
      />

      <Section>
        {isLoading && <LoadingBlock label="Loading events" />}
        {error && <ErrorBlock error={error} />}

        {data && (
          <>
            {data.featured.length > 0 && (
              <>
                <SectionHeading eyebrow="Event of the year" title="Annual Symposium" />
                <div className="mb-20 grid gap-6 md:grid-cols-3">
                  {data.featured.map((event) => (
                    <EventCard key={event.slug} event={event} />
                  ))}
                </div>
              </>
            )}

            <SectionHeading eyebrow="Next up" title="Upcoming" />
            {data.upcoming.length === 0 ? (
              <EmptyBlock title="Nothing scheduled right now" hint="New dates are published monthly." />
            ) : (
              <div className="grid gap-6 md:grid-cols-3">
                {data.upcoming.map((event) => (
                  <EventCard key={event.slug} event={event} />
                ))}
              </div>
            )}

            <div className="mt-20">
              <SectionHeading eyebrow="Selected history" title="Past highlights" />
              {data.past.length === 0 ? (
                <EmptyBlock title="No past events yet" />
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
