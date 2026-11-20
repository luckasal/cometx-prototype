import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ExternalLink, Images, Play } from "lucide-react";
import {
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  PageHero,
  Section,
  SectionHeading,
} from "@/components/site/Bits";
import { listPublicMedia } from "@/lib/public.functions";
import { useLanguage } from "@/contexts/LanguageContext";

export const Route = createFileRoute("/media")({
  head: () => ({
    meta: [
      { title: "Photos and videos - CometX" },
      { name: "description", content: "Published photos and video recordings from CometX events." },
    ],
  }),
  component: MediaPage,
});

function MediaPage() {
  const { language } = useLanguage();
  const cs = language === "cs";
  const fetchMedia = useServerFn(listPublicMedia);
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-media"],
    queryFn: () => fetchMedia(),
  });
  const [year, setYear] = useState("all");
  const years = useMemo(
    () =>
      Array.from(
        new Set(
          (data ?? [])
            .map((item) => item.publishedAt?.slice(0, 4))
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => b.localeCompare(a)),
    [data],
  );
  const visible = useMemo(
    () => (data ?? []).filter((item) => year === "all" || item.publishedAt?.startsWith(year)),
    [data, year],
  );
  const photos = visible.filter((item) => item.kind === "photo");
  const videos = visible.filter((item) => item.kind === "video");

  return (
    <>
      <PageHero
        tone="brand"
        eyebrow={cs ? "Ze života CometX" : "CometX in action"}
        title={cs ? "Fotky a videa" : "Photos and videos"}
        lead={
          cs
            ? "Záznamy přednášek a fotografie z akcí, které CometX zveřejnil."
            : "Talk recordings and event photos published by CometX."
        }
      />
      <Section>
        {years.length > 0 && (
          <div
            className="mb-10 flex flex-wrap items-center gap-2"
            aria-label={cs ? "Filtrovat podle roku" : "Filter by year"}
          >
            <button
              type="button"
              onClick={() => setYear("all")}
              aria-pressed={year === "all"}
              className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${year === "all" ? "border-ink bg-ink text-ink-foreground" : "border-border hover:border-ink"}`}
            >
              {cs ? "Vše" : "All"}
            </button>
            {years.map((itemYear) => (
              <button
                key={itemYear}
                type="button"
                onClick={() => setYear(itemYear)}
                aria-pressed={year === itemYear}
                className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${year === itemYear ? "border-ink bg-ink text-ink-foreground" : "border-border hover:border-ink"}`}
              >
                {itemYear}
              </button>
            ))}
          </div>
        )}
        {isLoading && <LoadingBlock label={cs ? "Načítáme archiv" : "Loading the archive"} />}
        {error && <ErrorBlock error={error} />}
        {data && data.length === 0 && (
          <EmptyBlock
            title={
              cs
                ? "Zatím tu nejsou zveřejněné fotografie ani videa"
                : "No published photos or videos yet"
            }
            hint={
              cs
                ? "Nový obsah se objeví po zveřejnění v CometX."
                : "New media appears here after CometX publishes it."
            }
          />
        )}
        {data && data.length > 0 && visible.length === 0 && (
          <EmptyBlock title={cs ? `Pro rok ${year} tu není žádný obsah` : `No media for ${year}`} />
        )}
        {videos.length > 0 && (
          <section className="mb-16" aria-labelledby="media-videos-heading">
            <SectionHeading
              id="media-videos-heading"
              eyebrow={cs ? "Záznamy" : "Watch"}
              title={cs ? "Záznamy přednášek" : "Talk recordings"}
            />
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {videos.map((item) => (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-[1.5rem] border border-border/80 bg-card"
                >
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="group relative grid aspect-video place-items-center overflow-hidden bg-ink text-ink-foreground"
                    aria-label={`${cs && item.title ? "Přehrát" : "Watch"}: ${!cs && item.titleEn?.trim() ? item.titleEn : item.title}`}
                  >
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 size-full object-cover opacity-75 transition-transform duration-500 group-hover:scale-105"
                      />
                    )}
                    <span className="relative grid size-14 place-items-center rounded-full border-2 border-accent bg-ink/75 text-accent">
                      <Play className="ml-1 size-6 fill-current" />
                    </span>
                  </a>
                  <div className="p-5">
                    <h2 className="font-display text-xl font-bold">
                      {!cs && item.titleEn?.trim() ? item.titleEn : item.title}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {item.publishedAt
                        ? new Date(item.publishedAt).toLocaleDateString(cs ? "cs-CZ" : "en-GB", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        : ""}
                    </p>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-4 inline-flex items-center gap-2 text-sm font-bold underline underline-offset-4"
                    >
                      {cs ? "Otevřít záznam" : "Open recording"}
                      <ExternalLink className="size-4" />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
        {photos.length > 0 && (
          <section aria-labelledby="media-photos-heading">
            <SectionHeading
              id="media-photos-heading"
              eyebrow={cs ? "Galerie" : "Gallery"}
              title={cs ? "Fotogalerie" : "Photo gallery"}
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {photos.map((item) => (
                <figure
                  key={item.id}
                  className="group overflow-hidden rounded-[1.25rem] border border-border/80 bg-card"
                >
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block aspect-[4/3] overflow-hidden bg-muted"
                  >
                    <img
                      src={item.imageUrl ?? item.url}
                      alt={!cs && item.titleEn?.trim() ? item.titleEn : item.title}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
                    />
                  </a>
                  <figcaption className="flex items-center justify-between gap-3 p-4 text-sm">
                    <span className="min-w-0 truncate font-semibold">
                      {!cs && item.titleEn?.trim() ? item.titleEn : item.title}
                    </span>
                    {item.eventSlug && (
                      <Link
                        to="/events/$slug"
                        params={{ slug: item.eventSlug }}
                        className="shrink-0 font-bold underline decoration-accent decoration-2 underline-offset-4"
                      >
                        {cs ? "Akce" : "Event"}
                      </Link>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}
        {data && data.length > 0 && photos.length === 0 && videos.length === 0 && (
          <EmptyBlock title={cs ? "V tomto filtru není žádný obsah" : "Nothing in this filter"} />
        )}
        {data && data.length > 0 && (
          <div className="mt-16 rounded-[1.5rem] bg-accent p-7 sm:p-9">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Images className="mb-3 size-6" />
                <h2 className="font-display text-2xl font-extrabold">
                  {cs ? "Přijďte na další akci" : "Join us at the next event"}
                </h2>
                <p className="mt-2 text-sm">
                  {cs
                    ? "Fotografie jsou jen část toho, co CometX nabízí."
                    : "There is more to CometX than the archive."}
                </p>
              </div>
              <Link
                to="/events"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-ink px-5 font-bold transition-colors hover:bg-ink hover:text-ink-foreground"
              >
                {cs ? "Nadcházející akce" : "Upcoming events"}
              </Link>
            </div>
          </div>
        )}
      </Section>
    </>
  );
}
