import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { EventDetailTemplate } from "@/components/site/EventDetailTemplate";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, CalendarDays, CheckCircle2, Languages, MapPin, Sparkles } from "lucide-react";
import { getEventDetail, reserveFreePlace } from "@/lib/events.functions";
import { Button } from "@/components/ui/button";
import {
  ErrorBlock,
  LoadingBlock,
  Section,
  SectionHeading,
  StatusPill,
} from "@/components/site/Bits";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { trackEvent } from "@/lib/analytics";

export const Route = createFileRoute("/events/$slug")({
  validateSearch: (search: Record<string, unknown>): { preview?: boolean } => ({ preview: search["preview"] === true || search["preview"] === 1 || search["preview"] === "1" || search["preview"] === "true" }),
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} - CometX event` },
      {
        name: "description",
        content: "Programme, speakers, workshops and tickets for this CometX event.",
      },
      { property: "og:title", content: "CometX event" },
      {
        property: "og:description",
        content: "Programme, speakers, workshops and tickets for this CometX event.",
      },
    ],
  }),
  component: EventDetailPage,
});

function EventDetailPage() {
  const { slug } = Route.useParams();
  const { preview } = Route.useSearch();
  const { language, toggleLanguage } = useLanguage();
  const cs = language === "cs";
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const fetchDetail = useServerFn(getEventDetail);
  const reserve = useServerFn(reserveFreePlace);

  const { data, isLoading, error } = useQuery({
    queryKey: ["event", slug, user?.id ?? "guest", preview ?? false],
    queryFn: () => fetchDetail({ data: { slug, preview } }),
    refetchOnWindowFocus: "always",
  });

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("cometx-event-saved");
    channel.onmessage = () => { void queryClient.invalidateQueries({ queryKey: ["event", slug] }); };
    return () => channel.close();
  }, [queryClient, slug]);

  const reserveMutation = useMutation({
    mutationFn: (ticketTypeId: string) => reserve({ data: { ticketTypeId } }),
    onSuccess: () => {
      trackEvent("event_registration", { event_slug: slug });
      toast.success(cs ? "Místo je rezervované. Najdete ho v Můj CometX." : "Your place is reserved. See it in My CometX.");
      queryClient.invalidateQueries({ queryKey: ["event", slug] });
      queryClient.invalidateQueries({ queryKey: ["account"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });


  if (isLoading)
    return (
      <Section>
        <LoadingBlock label={cs ? "Načítáme akci" : "Loading event"} />
      </Section>
    );
  if (error)
    return (
      <Section>
        <ErrorBlock error={error} />
      </Section>
    );
  if (!data)
    return (
      <Section>
        <h1 className="display-lg">{cs ? "Akce nebyla nalezena" : "Event not found"}</h1>
        <p className="mt-4 text-muted-foreground">
          {cs ? "Akce mohla být stažena z publikace." : "This event may have been unpublished."}{" "}
          <Link to="/events" className="underline underline-offset-4">
            {cs ? "Zpět na všechny akce" : "Back to all events"}
          </Link>
        </p>
      </Section>
    );

  const { event, tickets, speakers, workshops, partners } = data;
  const isSymposium2026 = slug === "annual-symposium-2026";
  const start = isSymposium2026
    ? new Date("2026-09-11T09:00:00+02:00")
    : new Date(event.startDate);

  if (isSymposium2026) {
    const copy = cs
      ? {
          edition: "6. ročník · proběhl 11. září 2026",
          title: "Slovenské a české výroční symposium 2026",
          intro:
            "Největší networkingové setkání Čechů a Slováků ve Švýcarsku spojilo profesionály, firmy, studenty a inspirativní osobnosti během jednoho intenzivního dne v Curychu.",
          date: "11. září 2026 · 09:00–23:00",
          venue: "UZH Zürich, Irchel Campus",
          completed: "Akce proběhla · vstupenky vyprodány",
          recap: "Jeden den. Desítky nových spojení. Komunita, která nekončí poslední přednáškou.",
          recapText:
            "Symposium nabídlo přednášky, panelové diskuse, praktické workshopy i večerní apéro. Především ale vytvořilo prostor potkat lidi, kteří rozumějí životu mezi Českem, Slovenskem a Švýcarskem.",
          expect: "Co účastníci zažili",
          programme: [
            ["Přednášky", "Osobní příběhy, expertiza a témata, která hýbou byznysem i společností."],
            ["Networking", "Prostor pro skutečné rozhovory, nové kontakty a budoucí spolupráce."],
            ["Workshopy", "Menší praktické formáty vedené zkušenými experty."],
            ["Panelové diskuse", "Různé pohledy na leadership, inovace a život ve Švýcarsku."],
          ],
          speakers: "Řečníci 2026",
          workshops: "Workshopy",
          tickets: "Jak fungovaly vstupenky",
          ticketNote: "Prodej skončil. Uvádíme původní strukturu vstupenek pro transparentní archiv akce.",
          ticketTypes: [
            ["Gold Ticket", "Vstup na symposium a rezervované místo na vybraném workshopu."],
            ["Real Cost Ticket", "Vstupenka pokrývající reálné náklady akce včetně jednoho workshopu dle výběru."],
            ["Extra Workshop 1–4", "Doplňková vstupenka pro účast na dalším workshopu; neprodávala se samostatně."],
          ],
          next: "Nechcete zmeškat další ročník?",
          nextText: "Staňte se členem CometX nebo sledujte nadcházející akce. Členové získávají přednostní informace a zvýhodněné vstupné.",
          membership: "Prohlédnout členství",
          events: "Další akce",
          supported: "Partneři akce",
          programmePdf: "Otevřít oficiální program",
          companyTitle: "Prezentujte svou firmu",
          companyLead: "Partnerské balíčky začínaly na 200 CHF. Pro další ročník kontaktujte tým CometX.",
          previous: "Předchozí ročníky",
        }
      : {
          edition: "6th edition · held on 11 September 2026",
          title: "6th Slovak and Czech Annual Symposium 2026",
          intro:
            "Switzerland's largest networking gathering for Czech and Slovak professionals brought together experts, companies, students and inspiring personalities for one remarkable day in Zurich.",
          date: "11 September 2026 · 09:00–23:00",
          venue: "UZH Zürich, Irchel Campus",
          completed: "Event completed · tickets sold out",
          recap: "One day. Dozens of new connections. A community that lasts beyond the final talk.",
          recapText:
            "The Symposium combined talks, panel discussions, practical workshops and an evening apéro. Above all, it created space to meet people who understand life between Czechia, Slovakia and Switzerland.",
          expect: "What attendees experienced",
          programme: [
            ["Talks", "Personal stories, expertise and topics shaping business and society."],
            ["Networking", "Space for real conversations, new contacts and future collaborations."],
            ["Workshops", "Small, practical sessions led by experienced experts."],
            ["Panel discussions", "Different perspectives on leadership, innovation and life in Switzerland."],
          ],
          speakers: "Speakers 2026",
          workshops: "Workshops",
          tickets: "How tickets worked",
          ticketNote: "Sales have ended. The original ticket structure is shown as a transparent event archive.",
          ticketTypes: [
            ["Gold Ticket", "Symposium admission plus a reserved place in one selected workshop."],
            ["Real Cost Ticket", "A ticket reflecting the real cost of attendance, including one workshop of choice."],
            ["Extra Workshop 1–4", "An add-on for a second workshop; it was not sold separately."],
          ],
          next: "Do not miss the next edition",
          nextText: "Become a CometX member or explore the upcoming programme. Members receive early news and preferred event pricing.",
          membership: "Explore membership",
          events: "Upcoming events",
          supported: "Event partners",
          programmePdf: "Open the official programme",
          companyTitle: "Present your company",
          companyLead: "Partner packages started at CHF 200. Contact the CometX team about the next edition.",
          previous: "Previous editions",
        };

    return (
      <>
        <section className="relative overflow-hidden bg-ink text-ink-foreground">
          {event.heroImageUrl && (
            <img src={event.heroImageUrl} alt="" className="absolute inset-0 size-full object-cover opacity-25" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/90 to-ink/35" />
          <div className="relative mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-28">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <StatusPill tone="signal">{copy.edition}</StatusPill>
              <button
                type="button"
                onClick={toggleLanguage}
                className="inline-flex items-center gap-2 rounded-full border border-ink-foreground/30 px-4 py-2 text-sm font-semibold hover:bg-ink-foreground/10"
              >
                <Languages className="size-4" /> {cs ? "English" : "Česky"}
              </button>
            </div>
            <div className="max-w-4xl">
              <p className="eyebrow text-accent">CometX · {cs ? "Akce roku" : "Event of the year"}</p>
              <h1 className="display-xl mt-4">{copy.title}</h1>
              <p className="mt-6 max-w-3xl text-lg leading-relaxed text-ink-foreground/80">{copy.intro}</p>
            </div>
            <dl className="mt-10 grid max-w-4xl gap-6 sm:grid-cols-3">
              <Meta icon={<CalendarDays className="size-4" />} label={cs ? "Datum" : "Date"}>{copy.date}</Meta>
              <Meta icon={<MapPin className="size-4" />} label={cs ? "Místo" : "Venue"}>{copy.venue}<span className="block text-ink-foreground/50">Winterthurerstrasse 190, 8057 Zürich</span></Meta>
              <Meta icon={<CheckCircle2 className="size-4" />} label={cs ? "Stav" : "Status"}>{copy.completed}</Meta>
            </dl>
          </div>
        </section>

        <Section>
          <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div><p className="eyebrow text-signal">{cs ? "Ohlédnutí" : "The experience"}</p><h2 className="display-lg mt-3">{copy.recap}</h2><p className="mt-6 text-lg leading-relaxed text-muted-foreground">{copy.recapText}</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              {copy.programme.map(([title, description]) => <div key={title} className="rounded-2xl border border-border/60 bg-card p-6"><Sparkles className="size-5 text-signal" /><h3 className="mt-5 font-display text-xl font-bold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p></div>)}
            </div>
          </div>
          <a href="https://www.cometx.ch/_files/ugd/41f758_e0c14abc95f14c25a35f71d07293165f.pdf" target="_blank" rel="noreferrer noopener" className="mt-8 inline-flex rounded-full border border-ink px-5 py-3 text-sm font-bold hover:bg-ink hover:text-ink-foreground">{copy.programmePdf}</a>

          {speakers.length > 0 && <div className="mt-20"><SectionHeading eyebrow={cs ? "Na pódiu" : "On stage"} title={copy.speakers} /><div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{speakers.map((s) => <article key={s.id} className="group overflow-hidden rounded-2xl border border-border/60 bg-card"><div className="aspect-square overflow-hidden bg-muted">{s.photoUrl && <img src={s.photoUrl} alt={s.name} className="size-full object-cover grayscale transition duration-300 group-hover:grayscale-0" loading="lazy" />}</div><div className="p-4"><h3 className="font-display text-lg font-bold">{s.name}</h3><p className="mt-1 text-xs text-muted-foreground">{s.jobTitle}{s.company ? ` · ${s.company}` : ""}</p></div></article>)}</div></div>}

          {workshops.length > 0 && <div className="mt-20"><SectionHeading eyebrow={cs ? "Prakticky" : "Hands-on"} title={copy.workshops} /><div className="grid gap-4 lg:grid-cols-2">{workshops.map((w, index) => <article key={w.id} className="flex gap-5 rounded-2xl border border-border/60 p-6"><span className="font-display text-3xl font-extrabold text-accent">{String(index + 1).padStart(2, "0")}</span><div><h3 className="font-display text-lg font-bold">{w.title}</h3><p className="mt-2 text-sm text-muted-foreground">{w.description}</p><p className="mt-3 text-xs font-semibold uppercase tracking-wider">{w.speakerName}</p></div></article>)}</div></div>}
        </Section>

        <section className="bg-muted/50">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 lg:grid-cols-[1fr_0.8fr] lg:px-8">
            <div><SectionHeading eyebrow={cs ? "Archiv akce" : "Event archive"} title={copy.tickets} /><p className="max-w-2xl text-sm text-muted-foreground">{copy.ticketNote}</p><div className="mt-8 grid gap-4">{copy.ticketTypes.map(([name, description]) => <div key={name} className="rounded-2xl border border-border/60 bg-background p-5"><p className="font-display text-lg font-bold">{name}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>)}</div></div>
            <aside className="rounded-3xl bg-ink p-8 text-ink-foreground lg:self-start"><p className="eyebrow text-accent">CometX 2027</p><h2 className="mt-3 font-display text-3xl font-extrabold">{copy.next}</h2><p className="mt-4 text-sm leading-relaxed text-ink-foreground/70">{copy.nextText}</p><div className="mt-8 grid gap-3"><Button asChild variant="signal"><Link to="/membership">{copy.membership}<ArrowRight className="size-4" /></Link></Button><Button asChild variant="outlineInk" className="border-ink-foreground/40 text-ink-foreground hover:bg-ink-foreground/10"><Link to="/events">{copy.events}</Link></Button></div></aside>
          </div>
        </section>

        <Section>
          <div className="grid gap-12 lg:grid-cols-[1fr_0.8fr]">
            <div>
              <SectionHeading eyebrow={cs ? "Pro firmy" : "For companies"} title={copy.companyTitle} />
              <p className="max-w-2xl text-sm text-muted-foreground">{copy.companyLead}</p>
              <div className="mt-7 grid gap-4 sm:grid-cols-3">
                {[
                  ["Silver", cs ? "1 vstup zdarma · logo na materiálech · sociální sítě · networking · distribuce materiálů" : "1 free entry · logo on materials · social visibility · networking · material distribution"],
                  ["Golden", cs ? "2 vstupy zdarma · Silver balíček · roll-up · 5minutový vstup nebo networkingový stůl" : "2 free entries · Silver package · roll-up display · 5-minute talk or networking table"],
                  ["Diamond", cs ? "3 vstupy zdarma · Golden balíček · 15minutová přednáška · networkingový stůl" : "3 free entries · Golden package · 15-minute talk · networking table"],
                ].map(([name, details]) => <article key={name} className="rounded-2xl border border-border/60 p-5"><h3 className="font-display text-xl font-bold">{name}</h3><p className="mt-2 text-sm text-muted-foreground">{details}</p></article>)}
              </div>
              <p className="mt-6 text-sm"><a href="mailto:adam.pruska@cometx.ch" className="underline underline-offset-4">adam.pruska@cometx.ch</a>{" · "}<a href="mailto:michaela.dohnalkova@cometx.ch" className="underline underline-offset-4">michaela.dohnalkova@cometx.ch</a></p>
            </div>
            <div>
              <SectionHeading eyebrow={cs ? "Archiv" : "Archive"} title={copy.previous} />
              <div className="grid grid-cols-2 gap-3">
                {[["2025", "https://www.cometx.ch/symposium-2025"], ["2024", "https://www.cometx.ch/symposium-2024"], ["2023", "https://www.cometx.ch/symposium-2023"], ["2022", "https://www.cometx.ch/symposium-2022"]].map(([year, href]) => <a key={year} href={href} target="_blank" rel="noreferrer noopener" className="rounded-2xl border border-border/60 p-5 font-display text-2xl font-extrabold hover:bg-paper">{year}</a>)}
              </div>
              <a href="https://www.cometx.ch/gallery" target="_blank" rel="noreferrer noopener" className="mt-4 inline-flex text-sm underline underline-offset-4">{cs ? "Fotografie a videa z akcí" : "Event photos and videos"}</a>
            </div>
          </div>
        </Section>

        {partners.length > 0 && <Section><SectionHeading eyebrow={cs ? "Děkujeme" : "With thanks"} title={copy.supported} /><div className="flex flex-wrap gap-x-10 gap-y-5">{partners.map((p) => <span key={p.id} className="font-display text-lg font-bold text-muted-foreground">{p.name}</span>)}</div></Section>}
      </>
    );
  }

  return <EventDetailTemplate data={data} pending={reserveMutation.isPending} onReserve={(id) => reserveMutation.mutate(id)} onLogin={() => navigate({ to: "/login", search: { redirect: `/events/${slug}` } })} />;
}

function Meta({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="eyebrow flex items-center gap-2 text-accent">
        {icon}
        {label}
      </dt>
      <dd className="mt-2 text-sm text-ink-foreground/85">{children}</dd>
    </div>
  );
}
