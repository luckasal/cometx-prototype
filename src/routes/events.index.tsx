import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  MapPin,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { listEvents, listPublicMedia, type PublicMediaItem } from "@/lib/public.functions";
import {
  getMembershipSavingsEvents,
  type MembershipSavingsEvent,
} from "@/lib/membership.functions";
import { formatMoney } from "@/lib/pricing";
import { ErrorBlock, LoadingBlock } from "@/components/site/Bits";
import { useLanguage } from "@/contexts/LanguageContext";
import { trackEvent } from "@/lib/analytics";

export const Route = createFileRoute("/events/")({
  head: () => ({
    meta: [
      { title: "Events - CometX" },
      {
        name: "description",
        content:
          "Browse upcoming CometX events, workshops, the Annual Symposium and the event archive.",
      },
      { property: "og:title", content: "CometX events" },
      {
        property: "og:description",
        content: "Upcoming and past CometX events across Switzerland and online.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EventsPage,
});

type EventListItem = {
  title: string;
  title_en: string | null;
  slug: string;
  event_type: string;
  short_description: string | null;
  short_description_en: string | null;
  hero_image_url: string | null;
  start_date: string;
  venue: string | null;
  venue_en: string | null;
  status: string;
  featured?: boolean;
};

function eventDayKey(value: string) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function localDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function eventCalendarMonth(value: string) {
  const [year = "1970", month = "01"] = eventDayKey(value).split("-");
  return new Date(Number(year), Number(month) - 1, 1);
}

function eventCategory(event: EventListItem, cs: boolean) {
  const venue = (!cs && event.venue_en?.trim() ? event.venue_en : event.venue)?.toLowerCase() ?? "";
  if (
    event.event_type === "online" ||
    event.event_type === "webinar" ||
    /online|virtual|virtu[aá]l/.test(venue)
  )
    return "online";
  if (event.event_type === "symposium") return "symposium";
  return "regular_event";
}

function categoryLabel(key: string, cs: boolean) {
  const labels: Record<string, { cs: string; en: string }> = {
    symposium: { cs: "SCAS · Výroční sympozium", en: "SCAS · Annual Symposium" },
    regular_event: { cs: "Menší akce", en: "Smaller events" },
    online: { cs: "Online", en: "Online" },
  };
  return labels[key]?.[cs ? "cs" : "en"] ?? key.replaceAll("_", " ");
}

function categoryDescription(key: string, cs: boolean) {
  const descriptions: Record<string, { cs: string; en: string }> = {
    symposium: {
      cs: "Hlavní akce roku, která propojuje českou a slovenskou komunitu ve Švýcarsku.",
      en: "CometX’s annual gathering for the Czech and Slovak community in Switzerland.",
    },
    regular_event: {
      cs: "Přednášky, debaty a networking během roku.",
      en: "Talks, discussions and networking throughout the year.",
    },
    online: {
      cs: "Virtuální sympozium a online setkání.",
      en: "Virtual symposiums and online meetups.",
    },
  };
  return descriptions[key]?.[cs ? "cs" : "en"] ?? "";
}

function EventsPage() {
  const { language } = useLanguage();
  const cs = language === "cs";
  const fetchEvents = useServerFn(listEvents);
  const fetchMedia = useServerFn(listPublicMedia);
  const fetchPrices = useServerFn(getMembershipSavingsEvents);
  const { data, isLoading, error } = useQuery({
    queryKey: ["events"],
    queryFn: () => fetchEvents(),
  });
  const {
    data: media = [],
    isLoading: mediaLoading,
    error: mediaError,
  } = useQuery({
    queryKey: ["public-media"],
    queryFn: () => fetchMedia(),
  });
  const { data: ticketPrices = [] } = useQuery({
    queryKey: ["published-event-ticket-prices"],
    queryFn: () => fetchPrices(),
  });
  const ticketPriceBySlug = useMemo(
    () => new Map(ticketPrices.map((item) => [item.slug, item])),
    [ticketPrices],
  );
  const [place, setPlace] = useState("all");
  const [archiveYear, setArchiveYear] = useState("all");
  const [calendarMonth, setCalendarMonth] = useState<Date | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const listViewSent = useRef(false);

  const allEvents = useMemo(() => {
    const unique = new Map<string, EventListItem>();
    for (const event of [
      ...(data?.featured ?? []),
      ...(data?.upcoming ?? []),
      ...(data?.past ?? []),
    ]) {
      unique.set(event.slug, event as EventListItem);
    }
    return [...unique.values()];
  }, [data]);
  const now = Date.now();
  const upcomingEvents = allEvents
    .filter(
      (event) =>
        Date.parse(event.start_date) >= now && !["completed", "cancelled"].includes(event.status),
    )
    .sort((a, b) => Date.parse(a.start_date) - Date.parse(b.start_date));
  const pastEvents = allEvents
    .filter((event) => !upcomingEvents.some((upcoming) => upcoming.slug === event.slug))
    .sort((a, b) => Date.parse(b.start_date) - Date.parse(a.start_date));
  const categories = ["symposium", "regular_event", "online"];
  const archiveYears = useMemo(
    () =>
      [...new Set(pastEvents.map((event) => eventDayKey(event.start_date).slice(0, 4)))]
        .sort()
        .reverse(),
    [pastEvents],
  );
  const venueFor = (event: EventListItem) =>
    (!cs && event.venue_en?.trim() ? event.venue_en : event.venue)?.trim() ?? "";
  const commonPlaceFilters = [
    { key: "all", label: cs ? "Vše" : "All" },
    { key: "zurich", label: "Zürich" },
    { key: "scas", label: "SCAS" },
    { key: "online", label: cs ? "Online" : "Online" },
  ];
  const matchesPlace = (event: EventListItem) => {
    if (place === "all") return true;
    if (place === "scas") return event.event_type === "symposium";
    if (place === "online") return eventCategory(event, cs) === "online";
    if (place === "zurich") return /zürich|zurich|curych/i.test(venueFor(event));
    return false;
  };
  const visibleUpcoming = upcomingEvents.filter(matchesPlace);
  const visiblePast = pastEvents.filter(
    (event) => archiveYear === "all" || eventDayKey(event.start_date).startsWith(archiveYear),
  );
  const activeMonth =
    calendarMonth ??
    (upcomingEvents[0] ? eventCalendarMonth(upcomingEvents[0].start_date) : new Date());
  const monthEvents = allEvents.filter((event) => {
    const eventMonth = eventDayKey(event.start_date).slice(0, 7);
    const visibleMonth = `${activeMonth.getFullYear()}-${String(activeMonth.getMonth() + 1).padStart(2, "0")}`;
    return eventMonth === visibleMonth;
  });
  const selectedDayEvents = selectedDay
    ? monthEvents.filter((event) => eventDayKey(event.start_date) === selectedDay)
    : monthEvents;

  useEffect(() => {
    if (!data || listViewSent.current) return;
    listViewSent.current = true;
    trackEvent("events_list_view", { event_count: allEvents.length });
  }, [allEvents.length, data]);

  return (
    <>
      <section className="bg-background">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-5 pb-10 pt-14 lg:px-6">
          <p className="eyebrow text-muted-foreground">CometX</p>
          <h1 className="font-display text-[clamp(2.75rem,4.5vw,3.25rem)] font-bold tracking-tight">
            {cs ? "Akce" : "Events"}
          </h1>
          <p className="max-w-[40em] text-lg leading-relaxed text-muted-foreground">
            {cs
              ? "SCAS každé září a menší akce během roku. Členské ceny najdete u každé akce."
              : "SCAS each September and smaller events throughout the year. Member pricing is shown for each event."}
          </p>
        </div>
      </section>

      <section aria-labelledby="event-types-title" className="bg-background pb-12 sm:pb-16">
        <div className="mx-auto max-w-[1200px] px-5 lg:px-6">
          <div className="mb-5">
            <h2 id="event-types-title" className="font-display text-2xl font-bold">
              {cs ? "Typy akcí" : "Event types"}
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {categories.map((item) => (
              <article
                key={item}
                className={`flex min-h-[150px] flex-col gap-2 rounded-[14px] border p-6 ${item === "symposium" ? "border-ink bg-ink text-ink-foreground" : "border-transparent bg-[#ECECEC] text-foreground"}`}
              >
                <span
                  className={`text-[13px] font-semibold uppercase tracking-[0.08em] ${item === "symposium" ? "text-accent" : "text-muted-foreground"}`}
                >
                  {item === "symposium"
                    ? cs
                      ? "Každé září"
                      : "Each September"
                    : item === "online"
                      ? cs
                        ? "Odkudkoli"
                        : "From anywhere"
                      : cs
                        ? "4–5× ročně"
                        : "Throughout the year"}
                </span>
                <h3 className="font-display text-[22px] font-bold">
                  {item === "symposium"
                    ? "SCAS – Slovak and Czech Annual Symposium"
                    : item === "online"
                      ? "Online"
                      : cs
                        ? "Menší akce"
                        : "Smaller events"}
                </h3>
                <span
                  className={`flex-1 text-[15px] leading-relaxed ${item === "symposium" ? "text-ink-foreground/75" : "text-muted-foreground"}`}
                >
                  {categoryDescription(item, cs)}
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="events-calendar"
        aria-labelledby="upcoming-events-title"
        className="scroll-mt-16 bg-background pb-14 sm:pb-16"
      >
        <div className="mx-auto max-w-[1200px] px-5 lg:px-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-5">
            <div>
              <h2 id="upcoming-events-title" className="font-display text-2xl font-bold">
                {cs ? "Nadcházející akce" : "Upcoming events"}
              </h2>
            </div>
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-label={cs ? "Filtrovat podle místa" : "Filter by location"}
            >
              {commonPlaceFilters.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={place === item.key}
                  onClick={() => setPlace(item.key)}
                  className={`min-h-11 rounded-full border-[1.5px] border-[#C9C7C4] px-4 text-[15px] font-medium transition ${place === item.key ? "border-ink bg-ink text-accent" : "bg-background hover:bg-muted"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {isLoading && <LoadingBlock label={cs ? "Načítáme akce" : "Loading events"} />}
          {error && <ErrorBlock error={error} />}
          {!isLoading && !error && visibleUpcoming.length === 0 && (
            <div className="rounded-3xl border border-border bg-muted px-6 py-14 text-center">
              <CalendarDays className="mx-auto size-8 text-muted-foreground" />
              <h3 className="mt-4 font-display text-xl font-bold">
                {upcomingEvents.length === 0
                  ? cs
                    ? "Zatím nejsou zveřejněné žádné budoucí akce"
                    : "No upcoming events have been published yet"
                  : cs
                    ? "Žádná akce neodpovídá výběru"
                    : "No events match these filters"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {cs
                  ? "Vraťte se později nebo si prohlédněte archiv."
                  : "Check back later or browse the archive below."}
              </p>
            </div>
          )}
          {!isLoading && !error && visibleUpcoming.length > 0 && (
            <div className="flex flex-col gap-4">
              {visibleUpcoming.map((event) => (
                <EventRow
                  key={event.slug}
                  event={event}
                  prices={ticketPriceBySlug.get(event.slug)}
                  cs={cs}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <CommunityCalendar
        events={allEvents}
        month={activeMonth}
        onMonthChange={setCalendarMonth}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        selectedDayEvents={selectedDayEvents}
        monthEvents={monthEvents}
        cs={cs}
      />

      <section
        id="past-events"
        aria-labelledby="past-events-title"
        className="bg-background py-14 sm:py-16"
      >
        <div className="mx-auto max-w-[1200px] px-5 lg:px-6">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow text-muted-foreground">
                {cs ? "Z historie CometX" : "From CometX history"}
              </p>
              <h2 id="past-events-title" className="font-display text-2xl font-bold">
                {cs ? "Uplynulé akce" : "Past events"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {cs
                  ? "Otevřete detail akce a navštivte archiv fotek a videí."
                  : "Open an event page or browse the photo and video archive."}
              </p>
            </div>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label={cs ? "Filtrovat archiv podle roku" : "Filter archive by year"}
            >
              {["all", ...archiveYears].map((year) => (
                <button
                  key={year}
                  type="button"
                  aria-pressed={archiveYear === year}
                  onClick={() => setArchiveYear(year)}
                  className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${archiveYear === year ? "border-ink bg-ink text-ink-foreground" : "border-border bg-card hover:bg-background"}`}
                >
                  {year === "all" ? (cs ? "Vše" : "All") : year}
                </button>
              ))}
            </div>
          </div>
          {isLoading && <LoadingBlock label={cs ? "Načítáme archiv" : "Loading archive"} />}
          {error && <ErrorBlock error={error} />}
          {!isLoading && !error && visiblePast.length === 0 && (
            <p className="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
              {pastEvents.length === 0
                ? cs
                  ? "Archiv se naplní po skončení zveřejněných akcí."
                  : "The archive will fill as published events finish."
                : cs
                  ? "V tomto roce nejsou akce v archivu."
                  : "There are no archived events for this year."}
            </p>
          )}
          {!isLoading && !error && visiblePast.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visiblePast.map((event) => (
                <PastEventCard key={event.slug} event={event} cs={cs} />
              ))}
            </div>
          )}
          <Link
            to="/media"
            className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full border border-foreground px-6 font-semibold transition hover:bg-background"
          >
            {cs ? "Celý archiv fotek a videí" : "Full photo and video archive"}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <section aria-labelledby="event-media-title" className="bg-muted py-14 sm:py-16">
        <div className="mx-auto max-w-[1200px] px-5 lg:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow text-muted-foreground">
                {cs ? "Momenty CometX" : "CometX moments"}
              </p>
              <h2 id="event-media-title" className="font-display text-2xl font-bold">
                {cs ? "Fotky a videa z akcí" : "Event photos and videos"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {cs
                  ? "Zveřejněné záznamy a galerie akcí CometX."
                  : "Published CometX event recordings and galleries."}
              </p>
            </div>
            <Link
              to="/media"
              className="inline-flex items-center gap-2 font-semibold underline decoration-accent decoration-2 underline-offset-4"
            >
              {cs ? "Celý archiv" : "Full archive"}
              <ArrowRight className="size-4" />
            </Link>
          </div>
          {mediaLoading && <LoadingBlock label={cs ? "Načítáme média" : "Loading media"} />}
          {mediaError && <ErrorBlock error={mediaError} />}
          {!mediaLoading && !mediaError && media.length === 0 && (
            <p className="rounded-2xl border border-border bg-muted p-8 text-sm text-muted-foreground">
              {cs
                ? "Zatím nejsou zveřejněné žádné fotografie ani videa."
                : "No photos or videos have been published yet."}
            </p>
          )}
          {!mediaLoading && !mediaError && media.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {media.slice(0, 3).map((item) => (
                <MediaCard key={item.id} item={item} cs={cs} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function EventRow({
  event,
  prices,
  cs,
}: {
  event: EventListItem;
  prices?: MembershipSavingsEvent | undefined;
  cs: boolean;
}) {
  const date = new Date(event.start_date);
  const title = !cs && event.title_en?.trim() ? event.title_en : event.title;
  const venue = !cs && event.venue_en?.trim() ? event.venue_en : event.venue;
  const day = new Intl.DateTimeFormat(cs ? "cs-CZ" : "en-GB", {
    timeZone: "Europe/Zurich",
    day: "numeric",
  }).format(date);
  const month = new Intl.DateTimeFormat(cs ? "cs-CZ" : "en-GB", {
    timeZone: "Europe/Zurich",
    month: "short",
  }).format(date);
  const year = new Intl.DateTimeFormat(cs ? "cs-CZ" : "en-GB", {
    timeZone: "Europe/Zurich",
    year: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat(cs ? "cs-CZ" : "en-GB", {
    timeZone: "Europe/Zurich",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  const memberPrices = Object.values(prices?.memberPrices ?? {}).filter(
    (price): price is number => price !== null,
  );
  const lowestMemberPrice = memberPrices.length ? Math.min(...memberPrices) : null;
  const actionLabel =
    event.status === "sold_out"
      ? cs
        ? "Vyprodáno"
        : "Sold out"
      : event.status === "registration_open"
        ? cs
          ? "Lístek"
          : "Tickets"
        : cs
          ? "Detail akce"
          : "Event details";

  return (
    <Link
      to="/events/$slug"
      params={{ slug: event.slug }}
      aria-label={`${title} · ${date.toLocaleDateString(cs ? "cs-CZ" : "en-GB", { timeZone: "Europe/Zurich", day: "numeric", month: "long", year: "numeric" })}`}
      className="group flex flex-wrap items-center gap-6 rounded-[14px] border border-[#E2E0DE] bg-background p-5 text-inherit transition hover:border-ink"
    >
      <time
        dateTime={event.start_date}
        className="grid size-[5.5rem] shrink-0 content-center rounded-xl bg-[#ECECEC] text-center text-foreground"
      >
        <span className="font-display text-3xl font-bold leading-none">{day}</span>
        <span className="mt-1 text-xs text-muted-foreground">
          {month} {year}
        </span>
      </time>
      <div className="min-w-0 flex-1 basis-[320px]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold text-muted-foreground">
          {venue && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {venue}
            </span>
          )}
          <span>{categoryLabel(eventCategory(event, cs), cs)}</span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="size-3.5" />
            {time}
          </span>
        </div>
        <h3 className="mt-1 font-display text-[22px] font-semibold leading-snug group-hover:underline">
          {title}
        </h3>
        {prices && (
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-[#ECECEC] px-3 py-1.5">
              {cs ? "Host" : "Guest"} {formatMoney(prices.guestPrice, prices.currency)}
            </span>
            {lowestMemberPrice !== null && (
              <span className="rounded-full bg-accent px-3 py-1.5 font-semibold text-accent-foreground">
                {lowestMemberPrice === 0
                  ? cs
                    ? "Member zdarma"
                    : "Free for members"
                  : `${cs ? "Member od" : "Member from"} ${formatMoney(lowestMemberPrice, prices.currency)}`}
              </span>
            )}
          </div>
        )}
      </div>
      <span className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 font-semibold text-accent-foreground transition group-hover:brightness-95">
        {actionLabel}
        <ArrowRight className="size-4" />
      </span>
    </Link>
  );
}

function PastEventCard({ event, cs }: { event: EventListItem; cs: boolean }) {
  const title = !cs && event.title_en?.trim() ? event.title_en : event.title;
  const venue = !cs && event.venue_en?.trim() ? event.venue_en : event.venue;
  const date = new Intl.DateTimeFormat(cs ? "cs-CZ" : "en-GB", {
    timeZone: "Europe/Zurich",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(event.start_date));

  return (
    <article className="flex flex-col gap-3">
      <Link
        to="/events/$slug"
        params={{ slug: event.slug }}
        className="group overflow-hidden rounded-2xl border border-border bg-muted"
        aria-label={cs ? `Otevřít archiv akce ${title}` : `Open ${title} event archive`}
      >
        {event.hero_image_url ? (
          <img
            src={event.hero_image_url}
            alt=""
            loading="lazy"
            className="aspect-[16/9] w-full object-cover grayscale transition duration-300 group-hover:grayscale-0"
          />
        ) : (
          <span className="grid aspect-[16/9] place-items-center text-sm text-muted-foreground">
            {cs ? "Archiv akce" : "Event archive"}
          </span>
        )}
      </Link>
      <div className="flex flex-col gap-1 px-1">
        <Link
          to="/events/$slug"
          params={{ slug: event.slug }}
          className="font-display text-lg font-bold leading-snug hover:underline"
        >
          {title}
        </Link>
        <p className="text-sm text-muted-foreground">{[date, venue].filter(Boolean).join(" · ")}</p>
        <Link
          to="/events/$slug"
          params={{ slug: event.slug }}
          className="mt-1 inline-flex items-center gap-2 text-sm font-semibold"
        >
          {cs ? "Fotky, videa a detail" : "Photos, video and details"}
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </article>
  );
}

function CommunityCalendar({
  events,
  month,
  onMonthChange,
  selectedDay,
  onSelectDay,
  selectedDayEvents,
  monthEvents,
  cs,
}: {
  events: EventListItem[];
  month: Date;
  onMonthChange: (date: Date) => void;
  selectedDay: string | null;
  onSelectDay: (day: string | null) => void;
  selectedDayEvents: EventListItem[];
  monthEvents: EventListItem[];
  cs: boolean;
}) {
  const weekdays = cs
    ? ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"]
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dateCells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const count = Math.ceil((offset + days) / 7) * 7;
    return Array.from({ length: count }, (_, index) => {
      const day = index - offset + 1;
      if (day < 1 || day > days) return null;
      const date = new Date(month.getFullYear(), month.getMonth(), day);
      return { day, key: localDayKey(date) };
    });
  }, [month]);
  const eventCounts = useMemo(() => {
    const counts = new Map<string, number>();
    events.forEach((event) => {
      const key = eventDayKey(event.start_date);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [events]);
  const monthName = new Intl.DateTimeFormat(cs ? "cs-CZ" : "en-GB", {
    month: "long",
    year: "numeric",
  }).format(month);

  return (
    <section
      id="community-calendar"
      aria-labelledby="community-calendar-title"
      className="bg-background py-12 sm:py-16"
    >
      <div className="mx-auto grid max-w-[1200px] gap-8 px-5 lg:grid-cols-[360px_minmax(0,1fr)] lg:px-6">
        <div>
          <p className="eyebrow text-muted-foreground">{cs ? "Všechny termíny" : "All dates"}</p>
          <h2 id="community-calendar-title" className="mt-2 font-display text-[32px] font-bold">
            {cs ? "Kalendář komunity" : "Community calendar"}
          </h2>
          <p className="mt-2 max-w-xl text-base text-muted-foreground">
            {cs
              ? "Zveřejněné akce CometX na jednom místě."
              : "Published CometX events in one place."}
          </p>
          <div className="mt-7 rounded-[18px] border border-[#E2E0DE] bg-card p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <button
                type="button"
                aria-label={cs ? "Předchozí měsíc" : "Previous month"}
                onClick={() =>
                  onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))
                }
                className="grid size-10 place-items-center rounded-full border border-border hover:bg-muted"
              >
                <ChevronLeft className="size-5" />
              </button>
              <h3 className="font-display text-xl font-bold capitalize">{monthName}</h3>
              <button
                type="button"
                aria-label={cs ? "Další měsíc" : "Next month"}
                onClick={() =>
                  onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))
                }
                className="grid size-10 place-items-center rounded-full border border-border hover:bg-muted"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {weekdays.map((day) => (
                <span key={day} className="pb-2 text-xs font-bold text-muted-foreground">
                  {day}
                </span>
              ))}
              {dateCells.map((cell, index) => {
                if (!cell)
                  return <span key={`empty-${index}`} aria-hidden="true" className="min-h-12" />;
                const count = eventCounts.get(cell.key) ?? 0;
                const selected = selectedDay === cell.key;
                return (
                  <button
                    key={cell.key}
                    type="button"
                    aria-pressed={selected}
                    aria-label={`${cell.key}${count ? `, ${count} ${cs ? "akcí" : "events"}` : ""}`}
                    onClick={() => onSelectDay(selected ? null : cell.key)}
                    className={`relative grid min-h-12 place-items-center rounded-xl text-sm font-semibold transition ${selected ? "bg-ink text-ink-foreground" : count ? "bg-accent/45 text-foreground hover:bg-accent" : "hover:bg-muted"}`}
                  >
                    {cell.day}
                    {count > 0 && (
                      <span
                        className={`absolute bottom-1.5 size-1.5 rounded-full ${selected ? "bg-accent" : "bg-ink"}`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="rounded-[18px] border border-[#E2E0DE] bg-card p-5 text-foreground sm:p-6">
          <div className="flex items-center gap-3">
            <CalendarDays className="size-5 text-accent" />
            <h3 className="font-display text-xl font-bold">
              {selectedDay
                ? cs
                  ? `Akce · ${selectedDay}`
                  : `Events · ${selectedDay}`
                : cs
                  ? `Akce · ${monthName}`
                  : `Events · ${monthName}`}
            </h3>
          </div>
          {selectedDayEvents.length === 0 ? (
            <p className="mt-5 rounded-2xl border border-border p-5 text-sm text-muted-foreground">
              {monthEvents.length === 0
                ? cs
                  ? "V tomto měsíci zatím není zveřejněná žádná akce."
                  : "No event has been published for this month yet."
                : cs
                  ? "Na tento den není naplánovaná žádná akce."
                  : "No event is scheduled for this day."}
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {selectedDayEvents.slice(0, 6).map((event) => (
                <li key={event.slug}>
                  <div className="flex flex-wrap items-center gap-4 rounded-[14px] border border-border px-4 py-3">
                    <p className="text-xs font-semibold text-foreground">
                      {new Intl.DateTimeFormat(cs ? "cs-CZ" : "en-GB", {
                        timeZone: "Europe/Zurich",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(event.start_date))}
                      {event.venue &&
                        ` · ${!cs && event.venue_en?.trim() ? event.venue_en : event.venue}`}
                    </p>
                    <Link
                      to="/events/$slug"
                      params={{ slug: event.slug }}
                      className="inline-flex items-center gap-2 font-semibold hover:underline"
                    >
                      {!cs && event.title_en?.trim() ? event.title_en : event.title}
                      <ArrowRight className="size-4" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {monthEvents.length}{" "}
            {cs
              ? monthEvents.length === 1
                ? "akce v měsíci"
                : "akcí v měsíci"
              : monthEvents.length === 1
                ? "event this month"
                : "events this month"}
          </p>
        </div>
      </div>
    </section>
  );
}

function MediaCard({ item, cs }: { item: PublicMediaItem; cs: boolean }) {
  const title = !cs && item.titleEn?.trim() ? item.titleEn : item.title;
  const date = item.publishedAt
    ? new Intl.DateTimeFormat(cs ? "cs-CZ" : "en-GB", {
        timeZone: "Europe/Zurich",
        year: "numeric",
        month: "long",
      }).format(new Date(item.publishedAt))
    : null;
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-[16/9] bg-ink">
        {item.imageUrl && (
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        )}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-ink-foreground">
          {item.kind === "video" ? (
            <Video className="size-3.5" />
          ) : (
            <CalendarDays className="size-3.5" />
          )}
          {item.kind === "video" ? (cs ? "Video" : "Video") : cs ? "Galerie" : "Gallery"}
        </span>
      </div>
      <div className="p-5">
        <h3 className="font-display text-lg font-bold">{title}</h3>
        {date && <p className="mt-1 text-sm text-muted-foreground">{date}</p>}
        <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold underline decoration-accent decoration-2 underline-offset-4">
          {cs ? "Otevřít" : "Open"}
          <ExternalLink className="size-3.5" />
        </span>
      </div>
    </a>
  );
}
