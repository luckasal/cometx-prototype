import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BrandXElement } from "./BrandXElement";
import { brandAssets } from "@/lib/brand-assets";
import { useLanguage } from "@/contexts/LanguageContext";

export function PageHero({
  eyebrow,
  title,
  lead,
  children,
  tone = "light",
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  children?: ReactNode;
  /** Brand treatment for public content pages. Keep the light version for checkout flows. */
  tone?: "light" | "brand";
}) {
  if (tone === "brand") {
    return (
      <section className="relative isolate overflow-hidden bg-ink text-ink-foreground">
        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-0 hidden w-[43%] bg-accent md:block [clip-path:polygon(34%_0,100%_0,100%_100%,0_100%)]"
        >
          <BrandXElement
            half
            className="absolute -right-24 -top-28 h-[34rem] w-auto opacity-25 mix-blend-multiply"
          />
        </div>
        <div aria-hidden="true" className="absolute inset-y-0 right-0 w-2 bg-accent md:hidden" />
        <div className="relative mx-auto max-w-7xl px-5 py-14 sm:py-16 lg:px-8 lg:py-24">
          <div className="max-w-4xl">
            {eyebrow && <p className="eyebrow text-accent">{eyebrow}</p>}
            <h1 className="mt-4 max-w-4xl font-display text-[clamp(2.6rem,6vw,5.25rem)] font-bold leading-[0.98] tracking-tight text-ink-foreground">
              {title}
            </h1>
            {lead && (
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-foreground/75">
                {lead}
              </p>
            )}
            {children && <div className="mt-8">{children}</div>}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-b-4xl bg-paper">
      <BrandXElement
        half
        className="absolute -right-20 -top-36 hidden h-[33rem] w-auto opacity-20 lg:block"
      />
      <div className="relative mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
        {eyebrow && <p className="eyebrow text-muted-foreground">{eyebrow}</p>}
        <h1 className="display-lg mt-4 max-w-4xl">{title}</h1>
        {lead && <p className="mt-6 max-w-2xl text-lg text-muted-foreground">{lead}</p>}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}

export function Section({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24", className)}>
      {children}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  action,
  id,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-border/80 pb-5">
      <div>
        <div className="flex items-center gap-3">
          <span className="brand-symbol">
            <img src={brandAssets.symbol} alt="" aria-hidden="true" width="28" height="28" />
          </span>
          {eyebrow && <p className="eyebrow text-muted-foreground">{eyebrow}</p>}
        </div>
        <h2
          id={id}
          className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl"
        >
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-16 text-sm text-muted-foreground">
      <span className="size-2 animate-pulse bg-accent" />
      {label}...
    </div>
  );
}

export function EmptyBlock({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-3xl bg-card px-6 py-14 text-center">
      <p className="font-display text-lg font-bold">{title}</p>
      {hint && <p className="mt-2 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ErrorBlock({ error }: { error: unknown }) {
  const message =
    error instanceof Error ? error.message : "Something went wrong. Please try again.";
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
      {message}
    </div>
  );
}

export function StatusPill({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "signal" | "muted" | "success";
}) {
  return (
    <span
      className={cn(
        "eyebrow inline-flex items-center rounded-full px-3.5 py-1.5",
        tone === "default" && "bg-ink text-ink-foreground",
        tone === "signal" && "bg-accent text-accent-foreground",
        tone === "muted" && "bg-muted text-muted-foreground",
        tone === "success" && "bg-success text-success-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function EventCard({
  event,
}: {
  event: {
    title: string;
    title_en?: string | null;
    slug: string;
    short_description: string | null;
    short_description_en?: string | null;
    hero_image_url: string | null;
    start_date: string;
    venue: string | null;
    venue_en?: string | null;
    status: string;
    featured?: boolean;
  };
}) {
  const { language } = useLanguage();
  const cs = language === "cs";
  const title = !cs && event.title_en?.trim() ? event.title_en : event.title;
  const description =
    !cs && event.short_description_en?.trim()
      ? event.short_description_en
      : event.short_description;
  const venue = !cs && event.venue_en?.trim() ? event.venue_en : event.venue;
  const date = new Date(event.start_date);
  const dateParts = { timeZone: "Europe/Zurich" };
  const day = new Intl.DateTimeFormat(cs ? "cs-CZ" : "en-GB", {
    ...dateParts,
    day: "2-digit",
  }).format(date);
  const month = new Intl.DateTimeFormat(cs ? "cs-CZ" : "en-GB", {
    ...dateParts,
    month: "short",
  }).format(date);
  const year = new Intl.DateTimeFormat(cs ? "cs-CZ" : "en-GB", {
    ...dateParts,
    year: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat(cs ? "cs-CZ" : "en-GB", {
    ...dateParts,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return (
    <Link
      to="/events/$slug"
      params={{ slug: event.slug }}
      data-analytics-cta={`event_card_${event.slug}`}
      className="group flex min-h-full flex-col rounded-[1.5rem] border border-border/80 bg-card p-5 transition-all hover:-translate-y-1 hover:border-ink/25 hover:shadow-lg sm:p-6"
    >
      <div className="flex items-start gap-4">
        <time
          dateTime={event.start_date}
          className="grid size-[4.5rem] shrink-0 content-center rounded-2xl bg-ink text-center text-ink-foreground"
        >
          <span className="font-display text-2xl font-extrabold leading-none text-accent">
            {day}
          </span>
          <span className="mt-1 text-xs font-semibold uppercase tracking-wide">
            {month} {year}
          </span>
        </time>
        <div className="min-w-0 flex-1 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            {venue && (
              <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
                {venue}
              </span>
            )}
            {event.status === "registration_open" && (
              <StatusPill tone="signal">{cs ? "V prodeji" : "Tickets on sale"}</StatusPill>
            )}
            {event.status === "registration_closed" && (
              <StatusPill tone="muted">
                {cs ? "Registrace uzavřena" : "Registration closed"}
              </StatusPill>
            )}
            {event.status === "sold_out" && (
              <StatusPill tone="muted">{cs ? "Vyprodáno" : "Sold out"}</StatusPill>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{time}</p>
        </div>
      </div>
      {event.hero_image_url && (
        <div className="mt-5 aspect-[16/9] overflow-hidden rounded-xl bg-muted">
          <img
            src={event.hero_image_url}
            alt={title}
            className="brand-photo size-full transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col pt-5">
        <h3 className="font-display text-xl font-bold leading-snug sm:text-2xl">{title}</h3>
        {description && (
          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{description}</p>
        )}
        <span className="mt-auto pt-5 text-sm font-bold underline decoration-accent decoration-2 underline-offset-4">
          {cs ? "Podrobnosti" : "Event details"} <span aria-hidden="true">→</span>
        </span>
      </div>
    </Link>
  );
}

export function Prose({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div className="space-y-5 text-[17px] leading-relaxed text-foreground/85">
      {text
        .split("\n")
        .filter(Boolean)
        .map((para, i) => (
          <p key={i}>{para}</p>
        ))}
    </div>
  );
}
