import { Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  Clock3,
  MapPin,
  Users,
  Ticket,
  CheckCircle2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import type { EventDetail } from "@/lib/events.functions";
import { splitEventContent } from "@/lib/event-content";
import { formatMoney } from "@/lib/pricing";
import { useLanguage } from "@/contexts/LanguageContext";
import { BrandXElement } from "./BrandXElement";
import { Button } from "@/components/ui/button";
import { StatusPill } from "./Bits";

type Props = {
  data: EventDetail;
  pending: boolean;
  onReserve: (ticketId: string, quantity:number) => void;
  onLogin: () => void;
};

export function EventDetailTemplate({ data, pending, onReserve, onLogin }: Props) {
  const { language } = useLanguage();
  const cs = language === "cs";
  const [quantities,setQuantities]=useState<Record<string,number>>({});
  const { event, tickets, speakers, workshops, partners } = data;
  const locale = cs ? "cs-CZ" : "en-GB";
  // Events are scheduled in Switzerland; do not shift the advertised date in a visitor's timezone.
  const date = (value: string) =>
    new Date(value).toLocaleDateString(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Zurich",
    });
  const time = (value: string) =>
    new Date(value).toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Zurich",
    });
  const over =
    event.status === "completed" ||
    (!data.registrationOpen && Date.parse(event.endDate ?? event.startDate) < Date.now());
  const cancelled = event.status === "cancelled";
  const soldOut =
    event.status === "sold_out" ||
    data.spotsLeft === 0 ||
    (tickets.length > 0 && tickets.every((t) => t.soldOut));
  const open = data.registrationOpen && !over && !cancelled && !soldOut && !data.isPreview;
  const status = data.isPreview
    ? cs
      ? "Náhled"
      : "Preview"
    : cancelled
      ? cs
        ? "Zrušeno"
        : "Cancelled"
      : over
        ? cs
          ? "Akce proběhla"
          : "Past event"
        : soldOut
          ? cs
            ? "Vyprodáno"
            : "Sold out"
          : open
            ? cs
              ? "Registrace otevřena"
              : "Registration open"
            : cs
              ? "Registrace uzavřena"
              : "Registration closed";
  const ticketCta = data.myRegistration
    ? cs
      ? "Moje registrace"
      : "My registration"
    : open && tickets.length
      ? cs
        ? "Vybrat vstupenku"
        : "Choose a ticket"
      : cs
        ? "Informace o vstupenkách"
        : "Ticket information";
  const ticketAction = (icon?: ReactNode) =>
    data.myRegistration ? (
      <Link to="/account/events">
        {ticketCta}
        {icon && <ArrowRight className="size-4" />}
      </Link>
    ) : (
      <a
        href="#event-ticket-options"
        onClick={(e) => {
          const target = document.getElementById("event-ticket-options");
          if (!target) return;
          e.preventDefault();
          target.focus({ preventScroll: true });
          target.scrollIntoView({ block: "center", behavior: "instant" });
        }}
      >
        {ticketCta}
        {icon}
      </a>
    );
  const portrait = speakers.find((s) => s.photoUrl);
  const heroImage = event.heroImageUrl || portrait?.photoUrl;
  const content = splitEventContent(event.description);
  const scheduled = workshops.filter((w) => w.startTime);
  const types: Record<string, string> = cs
    ? {
        event: "Akce",
        workshop: "Workshop",
        symposium: "Sympozium",
        networking: "Networking",
        webinar: "Webinář",
        online: "Online",
      }
    : {
        event: "Event",
        workshop: "Workshop",
        symposium: "Symposium",
        networking: "Networking",
        webinar: "Webinar",
        online: "Online",
      };
  const capacity =
    data.spotsLeft !== null
      ? `${data.spotsLeft} ${cs ? "volných míst" : "places available"}`
      : event.capacity !== null
        ? `${cs ? "Kapacita" : "Capacity"}: ${event.capacity}`
        : null;
  const eligible = tickets.filter((t) => t.price.eligible && !t.soldOut);
  const firstEligible = eligible[0];
  const sameCurrency =
    firstEligible && eligible.every((t) => t.price.currency === firstEligible.price.currency);
  const fromPrice =
    sameCurrency && firstEligible
      ? formatMoney(
          Math.min(...eligible.map((t) => t.price.finalPrice)),
          firstEligible.price.currency,
        )
      : null;

  return (
    <article className="pb-28 lg:pb-12 [&_button]:rounded-full [&_a.inline-flex]:rounded-full">
      {data.isPreview && (
        <div
          role="status"
          className="border-b border-accent/30 bg-accent/10 px-5 py-3 text-center text-sm"
        >
          <strong>{cs ? "Náhled pro správce" : "Admin preview"}</strong> · {event.publishState} ·{" "}
          {cs
            ? "Registrace je v náhledu vypnuta. Uložené změny se načítají automaticky."
            : "Booking is disabled in preview. Saved changes refresh automatically."}
        </div>
      )}
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Link
          to="/events"
          className="my-7 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-accent"
        >
          <ArrowRight className="size-4 rotate-180" />
          {cs ? "Všechny akce" : "All events"}
        </Link>
        <div className="grid items-start gap-x-12 gap-y-16 lg:grid-cols-[minmax(0,1fr)_23rem] xl:gap-x-20">
          <header className="relative min-w-0 overflow-hidden pb-2 lg:col-start-1 lg:row-start-1">
            <BrandXElement className="absolute right-0 top-0 -z-0 h-44 w-44 opacity-[0.06]" />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-3">
                <p className="eyebrow text-accent">{types[event.eventType] ?? event.eventType}</p>
                <StatusPill tone={open ? "signal" : "muted"}>{status}</StatusPill>
              </div>
              <h1 className="mt-6 text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.08] font-bold tracking-tight [overflow-wrap:anywhere]">
                {event.title}
              </h1>
              {speakers.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3">
                  {speakers.map((s) => (
                    <a
                      key={s.id}
                      href={`#speaker-${s.id}`}
                      className="inline-flex items-center gap-3 text-sm hover:text-accent"
                    >
                      {s.photoUrl && (
                        <img
                          src={s.photoUrl}
                          alt=""
                          className="size-10 rounded-full object-cover"
                        />
                      )}
                      <span>
                        <strong className="block">{s.name}</strong>
                        {(s.jobTitle || s.company) && (
                          <span className="block text-xs text-muted-foreground">
                            {[s.jobTitle, s.company].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </span>
                    </a>
                  ))}
                </div>
              )}
              {event.shortDescription && (
                <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                  {event.shortDescription}
                </p>
              )}
              <Button asChild variant="signal" size="lg" className="mt-9 rounded-full px-8">
                {ticketAction(<ArrowDown className="size-4" />)}
              </Button>
              {heroImage && (
                <figure className="mt-12 overflow-hidden rounded-[2rem] bg-paper">
                  <img
                    src={heroImage}
                    alt={event.heroImageUrl ? event.title : portrait!.name}
                    className="aspect-[4/3] w-full object-contain"
                    fetchPriority="high"
                  />
                </figure>
              )}
            </div>
          </header>

          <aside
            id="event-tickets"
            aria-label={cs ? "Informace a registrace" : "Event information and tickets"}
            className="scroll-mt-28 min-w-0 overflow-hidden rounded-[2rem] bg-card shadow-xl shadow-black/10 lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1 lg:row-span-2"
          >
            <div className="relative overflow-hidden bg-accent px-8 py-10 text-accent-foreground">
              <BrandXElement
                variant="fullDark"
                className="absolute -right-7 -top-5 h-40 w-40 opacity-10"
              />
              <p className="eyebrow">CometX</p>
              <h2 className="mt-1 text-2xl font-bold">{cs ? "Buďte u toho" : "Join the event"}</h2>
            </div>
            <div className="p-7 sm:p-8">
              <dl className="space-y-6 text-sm">
                <Info icon={<CalendarDays className="size-4" />} label={cs ? "Datum" : "Date"}>
                  <time dateTime={event.startDate}>{date(event.startDate)}</time>
                  {event.endDate && date(event.endDate) !== date(event.startDate) && (
                    <> – {date(event.endDate)}</>
                  )}
                </Info>
                <Info icon={<Clock3 className="size-4" />} label={cs ? "Čas" : "Time"}>
                  {time(event.startDate)}
                  {event.endDate && <> – {time(event.endDate)}</>}
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {cs ? "Čas ve Švýcarsku · Europe/Zurich" : "Swiss local time · Europe/Zurich"}
                  </span>
                </Info>
                {event.venue && (
                  <Info
                    icon={<MapPin className="size-4" />}
                    label={cs ? "Místo / online" : "Venue / online"}
                  >
                    {event.venue}
                    {event.address && (
                      <span className="mt-1 block text-muted-foreground">{event.address}</span>
                    )}
                  </Info>
                )}
                {capacity && (
                  <Info
                    icon={<Users className="size-4" />}
                    label={cs ? "Dostupnost" : "Availability"}
                  >
                    {soldOut ? (cs ? "Vyprodáno" : "Sold out") : capacity}
                  </Info>
                )}
                {event.registrationEnd && (
                  <Info
                    icon={<Ticket className="size-4" />}
                    label={cs ? "Registrace do" : "Registration deadline"}
                  >
                    {date(event.registrationEnd)} · {time(event.registrationEnd)}
                  </Info>
                )}
                {!data.registrationOpen &&
                  event.registrationStart &&
                  Date.parse(event.registrationStart) > Date.now() && (
                    <Info
                      icon={<Ticket className="size-4" />}
                      label={cs ? "Registrace od" : "Registration opens"}
                    >
                      {date(event.registrationStart)} · {time(event.registrationStart)}
                    </Info>
                  )}
              </dl>
              <div
                id="event-ticket-options"
                tabIndex={-1}
                aria-label={cs ? "Výběr vstupenky" : "Ticket options"}
                className="mt-9 scroll-mt-28 rounded-3xl bg-background/40 p-5 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-4 focus:ring-offset-card"
              >
                <h3 className="text-lg font-bold">{cs ? "Vstupenky" : "Tickets"}</h3>
                {data.membershipName && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {cs ? "Vaše členství" : "Your membership"}:{" "}
                    <strong className="text-foreground">{data.membershipName}</strong>
                  </p>
                )}
                {data.myRegistration && (
                  <div className="mt-5 space-y-4">
                    <p className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="size-5 text-accent" />
                      {cs ? "Jste registrováni" : "You're registered"}
                    </p>
                    <StatusPill tone="success">{data.myRegistration.status}</StatusPill>
                    <Button asChild variant="signal" className="w-full">
                      <Link to="/account/events">{cs ? "Moje registrace" : "My registration"}</Link>
                    </Button>
                  </div>
                )}
                {tickets.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    {cs ? "Vstupenky zatím nejsou k dispozici." : "No tickets are available yet."}
                  </p>
                ) : (
                  <div className="mt-5 space-y-6">
                    {tickets.map((ticket) => {
                      const saleOpen=(!ticket.saleStart || Date.parse(ticket.saleStart)<=Date.now()) && (!ticket.saleEnd || Date.parse(ticket.saleEnd)>Date.now());
                      const maxQuantity=Math.max(1,Math.min(ticket.spotsLeft ?? 10,data.spotsLeft ?? 10,10));
                      const quantity=quantities[ticket.id] ?? 1;
                      return (
                      <div key={ticket.id} className="rounded-2xl bg-card/60 py-4">
                        <h4 className="font-bold">{ticket.name}</h4>
                        {ticket.description && (
                          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                            {ticket.description}
                          </p>
                        )}
                        <dl className="mt-4 space-y-2 text-sm">
                          <div className="flex flex-wrap justify-between gap-2">
                            <dt className="text-muted-foreground">
                              {cs ? "Běžná cena" : "Regular price"}
                            </dt>
                            <dd className="font-semibold">
                              {formatMoney(ticket.price.basePrice, ticket.price.currency)}
                            </dd>
                          </div>
                          {ticket.price.discount > 0 || ticket.price.includedInMembership ? (
                            <div className="flex flex-wrap justify-between gap-2 text-accent">
                              <dt>{cs ? "Vaše členská cena" : "Your member price"}</dt>
                              <dd className="font-bold">
                                {ticket.price.includedInMembership
                                  ? cs
                                    ? "V ceně členství"
                                    : "Included"
                                  : formatMoney(ticket.price.finalPrice, ticket.price.currency)}
                              </dd>
                            </div>
                          ) : null}
                          {!data.membershipName && ticket.memberPrice !== null && (
                            <div className="flex flex-wrap justify-between gap-2 text-accent">
                              <dt>{cs ? "Cena pro členy" : "Member price"}</dt>
                              <dd className="font-bold">
                                {formatMoney(ticket.memberPrice, ticket.price.currency)}
                              </dd>
                            </div>
                          )}
                        </dl>
                        {!data.membershipName && ticket.hasMemberPricing && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {cs
                              ? "Přihlaste se nebo se přidejte do CometX pro členskou cenu."
                              : "Log in or join CometX to access member pricing."}
                          </p>
                        )}
                        {ticket.spotsLeft !== null && (
                          <p className="mt-3 text-xs text-muted-foreground">
                            {cs ? "Zbývá míst pro tento typ" : "Places left for this ticket"}:{" "}
                            {data.spotsLeft === null
                              ? ticket.spotsLeft
                              : Math.min(ticket.spotsLeft, data.spotsLeft)}
                          </p>
                        )}
                        <div className="mt-4">
                          {data.isPreview ? (
                            <Button disabled className="w-full" variant="outline">
                              {cs ? "Registrace v náhledu vypnuta" : "Booking disabled in preview"}
                            </Button>
                          ) : !open || ticket.soldOut || !saleOpen ? (
                            <Button disabled className="w-full" variant="outline">
                              {ticket.soldOut || soldOut ? (cs ? "Vyprodáno" : "Sold out") : !saleOpen ? (cs ? "Prodej vstupenek uzavřen" : "Ticket sales closed") : status}
                            </Button>
                          ) : !data.isSignedIn ? (
                            <Button variant="signal" className="w-full" onClick={onLogin}>
                              {cs ? "Přihlásit a registrovat" : "Log in to register"}
                              <ArrowRight className="size-4" />
                            </Button>
                          ) : !ticket.price.eligible ? (
                            <>
                              <p className="mb-3 text-xs text-muted-foreground">
                                {cs
                                  ? "Tato vstupenka vyžaduje odpovídající členskou výhodu."
                                  : "This ticket requires an eligible membership benefit."}
                              </p>
                              <Button asChild variant="outline" className="w-full">
                                <Link to="/membership">
                                  {cs ? "Prohlédnout členství" : "Explore membership"}
                                </Link>
                              </Button>
                            </>
                          ) : (
                            <>
                            <label className="flex items-center justify-between gap-3 text-sm">
                              <span>{cs ? "Počet vstupenek" : "Quantity"}</span>
                              <select aria-label={cs ? `Počet vstupenek: ${ticket.name}` : `Ticket quantity: ${ticket.name}`} className="min-h-10 rounded-full bg-background px-4" value={quantity}
                                onChange={e=>setQuantities(previous=>({...previous,[ticket.id]:Number(e.target.value)}))}>
                                {Array.from({length:maxQuantity},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}</option>)}
                              </select>
                            </label>
                            <Button
                              variant="signal"
                              className="w-full"
                              disabled={pending}
                              onClick={() => onReserve(ticket.id,quantity)}
                            >
                              {pending
                                ? cs
                                  ? "Rezervujeme…"
                                  : "Opening checkout…"
                                : cs
                                  ? "Koupit vstupenky"
                                  : "Buy tickets"}
                              <ArrowRight className="size-4" />
                            </Button>
                            </>
                          )}
                        </div>
                      </div>
                    )})}
                  </div>
                )}
                {!data.myRegistration && tickets.length > 0 && open && (
                  <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
                    {cs
                      ? "Platba proběhne bezpečně přes Stripe."
                      : "Secure payment is handled by Stripe Checkout."}
                  </p>
                )}
              </div>
            </div>
          </aside>

          <div className="min-w-0 space-y-16 lg:col-start-1 lg:row-start-2 lg:space-y-20">
            {content.map((section, index) => (
              <ContentSection
                key={index}
                title={section.title ?? (cs ? "O akci" : "About this event")}
              >
                <EventText text={section.body} />
              </ContentSection>
            ))}
            {scheduled.length > 0 && (
              <ContentSection title={cs ? "Program" : "Programme"}>
                <ol className="space-y-3 rounded-3xl bg-card p-6 sm:p-8">
                  {scheduled.map((w) => (
                    <li key={w.id} className="grid grid-cols-[4rem_1fr] gap-5 py-4">
                      <time dateTime={w.startTime!} className="font-bold text-accent">
                        {time(w.startTime!)}
                      </time>
                      <div>
                        <p className="font-semibold">{w.title}</p>
                        {w.speakerName && (
                          <p className="mt-1 text-sm text-muted-foreground">{w.speakerName}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </ContentSection>
            )}
            {workshops.length > 0 && (
              <ContentSection title={cs ? "Workshopy" : "Workshops"}>
                <div className="space-y-4">
                  {workshops.map((w) => (
                    <article key={w.id} className="rounded-3xl bg-card p-7 sm:p-9">
                      <h3 className="text-xl font-bold">{w.title}</h3>
                      {w.description && (
                        <div className="mt-3">
                          <EventText text={w.description} />
                        </div>
                      )}
                      {(w.speakerName || w.location) && (
                        <p className="mt-4 text-sm text-muted-foreground">
                          {[w.speakerName, w.location].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {w.basePrice > 0 && (
                        <p className="mt-3 text-sm font-semibold">{formatMoney(w.basePrice)}</p>
                      )}
                    </article>
                  ))}
                </div>
              </ContentSection>
            )}
            {speakers.length > 0 && (
              <ContentSection title={cs ? "S kým se potkáte" : "Meet the speakers"}>
                <div className="space-y-10">
                  {speakers.map((s) => (
                    <article
                      id={`speaker-${s.id}`}
                      key={s.id}
                      className="scroll-mt-28 grid gap-7 rounded-3xl bg-card/60 p-6 sm:grid-cols-[9rem_minmax(0,1fr)] sm:p-8"
                    >
                      {s.photoUrl ? (
                        <img
                          src={s.photoUrl}
                          alt={s.name}
                          loading="lazy"
                          className="aspect-square w-36 rounded-3xl object-cover"
                        />
                      ) : (
                        <div
                          aria-hidden="true"
                          className="hidden aspect-square w-36 overflow-hidden rounded-3xl bg-paper sm:block"
                        >
                          <BrandXElement className="h-full w-full opacity-20" />
                        </div>
                      )}
                      <div>
                        <h3 className="text-2xl font-bold">{s.name}</h3>
                        {(s.jobTitle || s.company) && (
                          <p className="mt-2 text-sm text-accent">
                            {[s.jobTitle, s.company].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        {s.bio && (
                          <div className="mt-4">
                            <EventText text={s.bio} />
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </ContentSection>
            )}
            {(event.venue || event.address) && (
              <ContentSection title={cs ? "Praktické informace" : "Practical information"}>
                <div className="flex gap-4">
                  <MapPin className="mt-1 size-5 shrink-0 text-accent" />
                  <div>
                    {event.venue && <h3 className="font-semibold">{event.venue}</h3>}
                    {event.address && (
                      <p className="mt-2 whitespace-pre-line text-muted-foreground">
                        {event.address}
                      </p>
                    )}
                  </div>
                </div>
              </ContentSection>
            )}
            {event.galleryUrls.length > 0 && (
              <ContentSection title={cs ? "Galerie" : "Gallery"}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {event.galleryUrls.map((url, i) => (
                    <img
                      key={`${url}-${i}`}
                      src={url}
                      alt={`${event.title} · ${i + 1}`}
                      loading="lazy"
                      className="aspect-[4/3] w-full rounded-3xl object-cover"
                    />
                  ))}
                </div>
              </ContentSection>
            )}
            {partners.length > 0 && (
              <ContentSection title={cs ? "Partneři akce" : "Event partners"}>
                <ul className="flex flex-wrap gap-6">
                  {partners.map((p) => (
                    <li key={p.id} className="font-semibold">
                      {p.name}
                    </li>
                  ))}
                </ul>
              </ContentSection>
            )}
            {open && tickets.length > 0 && (
              <div className="rounded-[2rem] bg-accent p-8 text-accent-foreground sm:p-12">
                <p className="text-2xl font-bold sm:text-3xl">{event.title}</p>
                <p className="mt-4 text-sm text-accent-foreground/75">
                  {date(event.startDate)}
                  {event.venue ? ` · ${event.venue}` : ""}
                </p>
                <Button
                  asChild
                  variant="signal"
                  className="mt-7 rounded-full bg-ink px-7 text-ink-foreground hover:bg-ink/90"
                >
                  {ticketAction(<ArrowRight className="size-4" />)}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="fixed inset-x-2 bottom-2 z-40 flex items-center justify-between gap-3 rounded-3xl bg-card/95 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl shadow-black/20 backdrop-blur lg:hidden">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{status}</p>
          {fromPrice && open && (
            <p className="font-bold">
              {eligible.length > 1 ? (cs ? "Od " : "From ") : ""}
              {fromPrice}
            </p>
          )}
        </div>
        <Button asChild variant="signal" size="sm" className="shrink-0">
          {ticketAction()}
        </Button>
      </div>
    </article>
  );
}

function Info({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-1 shrink-0 text-accent" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-1 font-medium [overflow-wrap:anywhere]">{children}</dd>
      </div>
    </div>
  );
}
function ContentSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-8 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      {children}
    </section>
  );
}
function EventText({ text }: { text: string }) {
  return (
    <div className="space-y-4 text-base leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
      {text
        .split(/\n\s*\n/)
        .filter(Boolean)
        .map((block, i) => {
          const lines = block.split("\n");
          return lines.every((line) => /^\s*[-*•]\s+/.test(line)) ? (
            <ul key={i} className="list-disc space-y-2 pl-5 marker:text-accent">
              {lines.map((line, j) => (
                <li key={j}>{line.replace(/^\s*[-*•]\s+/, "")}</li>
              ))}
            </ul>
          ) : (
            <p key={i} className="whitespace-pre-line">
              {block}
            </p>
          );
        })}
    </div>
  );
}
