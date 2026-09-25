import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BrandXElement } from "./BrandXElement";
import { brandAssets } from "@/lib/brand-assets";

export function PageHero({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-border bg-paper">
      <BrandXElement half className="absolute -right-20 -top-36 hidden h-[33rem] w-auto opacity-20 lg:block" />
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
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24", className)}>
      {children}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div>
        <div className="flex items-center gap-3">
          <span className="brand-symbol"><img src={brandAssets.symbol} alt="" aria-hidden="true" width="28" height="28" /></span>
          {eyebrow && <p className="eyebrow text-muted-foreground">{eyebrow}</p>}
        </div>
        <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight">{title}</h2>
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
    <div className="border border-dashed border-border px-6 py-14 text-center">
      <p className="font-display text-lg font-bold">{title}</p>
      {hint && <p className="mt-2 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ErrorBlock({ error }: { error: unknown }) {
  const message =
    error instanceof Error ? error.message : "Something went wrong. Please try again.";
  return (
    <div className="border-l-2 border-destructive bg-destructive/5 px-5 py-4 text-sm text-destructive">
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
        "eyebrow inline-flex items-center px-2.5 py-1",
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
    slug: string;
    short_description: string | null;
    hero_image_url: string | null;
    start_date: string;
    venue: string | null;
    status: string;
    featured?: boolean;
  };
}) {
  const date = new Date(event.start_date);
  return (
    <Link
      to="/events/$slug"
      params={{ slug: event.slug }}
      className="group flex flex-col border border-border bg-card transition-colors hover:border-ink"
    >
      <div className="aspect-[16/10] overflow-hidden bg-muted">
        {event.hero_image_url && (
          <img
            src={event.hero_image_url}
            alt={event.title}
            className="brand-photo size-full transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center gap-3">
          <span className="eyebrow text-muted-foreground">
            {date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
          </span>
          {event.status === "registration_open" && <StatusPill tone="signal">Open</StatusPill>}
          {event.status === "completed" && <StatusPill tone="muted">Past</StatusPill>}
        </div>
        <h3 className="mt-3 font-display text-xl font-bold leading-snug">{event.title}</h3>
        {event.short_description && (
          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
            {event.short_description}
          </p>
        )}
        {event.venue && (
          <p className="mt-4 text-xs text-muted-foreground">{event.venue}</p>
        )}
      </div>
    </Link>
  );
}

export function Prose({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div className="space-y-5 text-[17px] leading-relaxed text-foreground/85">
      {text.split("\n").filter(Boolean).map((para, i) => (
        <p key={i}>{para}</p>
      ))}
    </div>
  );
}
