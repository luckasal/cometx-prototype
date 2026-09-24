import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useState } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, Languages, MapPin, Sparkles, Users } from "lucide-react";
import { getEventDetail, reserveFreePlace } from "@/lib/events.functions";
import { formatMoney } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import {
  ErrorBlock,
  LoadingBlock,
  Prose,
  Section,
  SectionHeading,
  StatusPill,
} from "@/components/site/Bits";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/events/$slug")({
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
  const [symposiumLanguage, setSymposiumLanguage] = useState<"cs" | "en">("cs");
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const fetchDetail = useServerFn(getEventDetail);
  const reserve = useServerFn(reserveFreePlace);

  const { data, isLoading, error } = useQuery({
    queryKey: ["event", slug, user?.id ?? "guest"],
    queryFn: () => fetchDetail({ data: { slug } }),
  });

  const reserveMutation = useMutation({
    mutationFn: (ticketTypeId: string) => reserve({ data: { ticketTypeId } }),
    onSuccess: () => {
      toast.success("Your place is reserved. See it in My CometX.");
      queryClient.invalidateQueries({ queryKey: ["event", slug] });
      queryClient.invalidateQueries({ queryKey: ["account"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });


  if (isLoading)
    return (
      <Section>
        <LoadingBlock label="Loading event" />
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
        <h1 className="display-lg">Event not found</h1>
        <p className="mt-4 text-muted-foreground">
          This event may have been unpublished.{" "}
          <Link to="/events" className="underline underline-offset-4">
            Back to all events
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
    const cs = symposiumLanguage === "cs";
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
                onClick={() => setSymposiumLanguage(cs ? "en" : "cs")}
                className="inline-flex items-center gap-2 border border-ink-foreground/30 px-4 py-2 text-sm font-semibold hover:bg-ink-foreground/10"
              >
                <Languages className="size-4" /> {cs ? "English" : "Česky"}
              </button>
            </div>
            <div className="max-w-4xl">
              <p className="eyebrow text-accent">CometX · Event of the year</p>
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

        <section className="bg-accent text-accent-foreground">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-5 py-8 sm:grid-cols-4 lg:px-8">
            {[["320+", cs ? "účastníků" : "attendees"], ["27", cs ? "zapojených firem" : "companies"], ["5", cs ? "workshopů" : "workshops"], ["23", cs ? "řečníků a hostů" : "speakers & guests"]].map(([value, label]) => (
              <div key={label} className="px-4 py-3 text-center"><p className="font-display text-3xl font-extrabold">{value}</p><p className="mt-1 text-xs font-semibold uppercase tracking-wider">{label}</p></div>
            ))}
          </div>
        </section>

        <Section>
          <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div><p className="eyebrow text-signal">{cs ? "Ohlédnutí" : "The experience"}</p><h2 className="display-lg mt-3">{copy.recap}</h2><p className="mt-6 text-lg leading-relaxed text-muted-foreground">{copy.recapText}</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              {copy.programme.map(([title, description]) => <div key={title} className="border border-border bg-card p-6"><Sparkles className="size-5 text-signal" /><h3 className="mt-5 font-display text-xl font-bold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p></div>)}
            </div>
          </div>

          {speakers.length > 0 && <div className="mt-20"><SectionHeading eyebrow={cs ? "Na pódiu" : "On stage"} title={copy.speakers} /><div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{speakers.map((s) => <article key={s.id} className="group border border-border bg-card"><div className="aspect-square overflow-hidden bg-muted">{s.photoUrl && <img src={s.photoUrl} alt={s.name} className="size-full object-cover grayscale transition duration-300 group-hover:grayscale-0" loading="lazy" />}</div><div className="p-4"><h3 className="font-display text-lg font-bold">{s.name}</h3><p className="mt-1 text-xs text-muted-foreground">{s.jobTitle}{s.company ? ` · ${s.company}` : ""}</p></div></article>)}</div></div>}

          {workshops.length > 0 && <div className="mt-20"><SectionHeading eyebrow={cs ? "Prakticky" : "Hands-on"} title={copy.workshops} /><div className="grid gap-4 lg:grid-cols-2">{workshops.map((w, index) => <article key={w.id} className="flex gap-5 border border-border p-6"><span className="font-display text-3xl font-extrabold text-accent">{String(index + 1).padStart(2, "0")}</span><div><h3 className="font-display text-lg font-bold">{w.title}</h3><p className="mt-2 text-sm text-muted-foreground">{w.description}</p><p className="mt-3 text-xs font-semibold uppercase tracking-wider">{w.speakerName}</p></div></article>)}</div></div>}
        </Section>

        <section className="bg-muted/50">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 lg:grid-cols-[1fr_0.8fr] lg:px-8">
            <div><SectionHeading eyebrow={cs ? "Archiv akce" : "Event archive"} title={copy.tickets} /><p className="max-w-2xl text-sm text-muted-foreground">{copy.ticketNote}</p><div className="mt-8 grid gap-4">{copy.ticketTypes.map(([name, description]) => <div key={name} className="border border-border bg-background p-5"><p className="font-display text-lg font-bold">{name}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>)}</div></div>
            <aside className="border border-ink bg-ink p-8 text-ink-foreground lg:self-start"><p className="eyebrow text-accent">CometX 2027</p><h2 className="mt-3 font-display text-3xl font-extrabold">{copy.next}</h2><p className="mt-4 text-sm leading-relaxed text-ink-foreground/70">{copy.nextText}</p><div className="mt-8 grid gap-3"><Button asChild variant="signal"><Link to="/membership">{copy.membership}<ArrowRight className="size-4" /></Link></Button><Button asChild variant="outlineInk" className="border-ink-foreground/40 text-ink-foreground hover:bg-ink-foreground/10"><Link to="/events">{copy.events}</Link></Button></div></aside>
          </div>
        </section>

        {partners.length > 0 && <Section><SectionHeading eyebrow={cs ? "Děkujeme" : "With thanks"} title={copy.supported} /><div className="flex flex-wrap gap-x-10 gap-y-5">{partners.map((p) => <span key={p.id} className="font-display text-lg font-bold text-muted-foreground">{p.name}</span>)}</div></Section>}
      </>
    );
  }

  return (
    <>
      <section className="bg-ink text-ink-foreground">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8 lg:py-24">
          <div>
            {event.featured && <StatusPill tone="signal">Flagship event</StatusPill>}
            <h1 className="display-xl mt-5">{event.title}</h1>
            <p className="mt-6 max-w-xl text-lg text-ink-foreground/70">{event.shortDescription}</p>
            <dl className="mt-10 grid gap-5 sm:grid-cols-3">
              <Meta icon={<CalendarDays className="size-4" />} label="Date">
                {start.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </Meta>
              <Meta icon={<MapPin className="size-4" />} label="Where">
                {event.venue ?? "To be announced"}
                {event.address && (
                  <span className="block text-ink-foreground/50">{event.address}</span>
                )}
              </Meta>
              <Meta icon={<Users className="size-4" />} label="Places left">
                {data.spotsLeft === null ? (data.event.capacity === null ? "Open capacity" : "Checked when booking") : data.spotsLeft}
              </Meta>
            </dl>
          </div>
          <div className="aspect-[4/3] bg-ink-foreground/10">
            {event.heroImageUrl && (
              <img src={event.heroImageUrl} alt={event.title} className="size-full object-cover" />
            )}
          </div>
        </div>
      </section>

      <Section>
        <div className="grid gap-14 lg:grid-cols-[1.3fr_0.7fr]">
          <div>
            <SectionHeading eyebrow="About" title="The programme" />
            <Prose text={event.description} />

            {workshops.length > 0 && (
              <div className="mt-16">
                <SectionHeading eyebrow="Workshop floor" title="Workshops" />
                <ul className="divide-y divide-border border-y border-border">
                  {workshops.map((w) => (
                    <li key={w.id} className="flex flex-wrap justify-between gap-4 py-5">
                      <div>
                        <p className="font-display text-lg font-bold">{w.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{w.description}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {w.speakerName ? `${w.speakerName} - ` : ""}
                          {w.location}
                          {w.startTime
                            ? ` - ${new Date(w.startTime).toLocaleTimeString("en-GB", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}`
                            : ""}
                        </p>
                      </div>
                      <p className="font-display text-base font-bold">
                        {formatMoney(w.basePrice)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {speakers.length > 0 && (
              <div className="mt-16">
                <SectionHeading eyebrow="On stage" title="Speakers" />
                <div className="grid gap-8 sm:grid-cols-2">
                  {speakers.map((s) => (
                    <div key={s.id} className="flex gap-4">
                      <div className="size-20 shrink-0 bg-muted">
                        {s.photoUrl && (
                          <img
                            src={s.photoUrl}
                            alt={s.name}
                            className="size-full object-cover"
                            loading="lazy"
                          />
                        )}
                      </div>
                      <div>
                        <p className="font-display font-bold">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.jobTitle}
                          {s.company ? `, ${s.company}` : ""}
                        </p>
                        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{s.bio}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {partners.length > 0 && (
              <div className="mt-16">
                <SectionHeading eyebrow="Supported by" title="Event partners" />
                <div className="flex flex-wrap gap-x-10 gap-y-4">
                  {partners.map((p) => (
                    <span key={p.id} className="font-display font-bold text-muted-foreground">
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* TICKETS */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="border border-ink">
              <div className="border-b border-ink bg-ink px-6 py-4 text-ink-foreground">
                <p className="eyebrow text-accent">Registration</p>
                <p className="mt-1 font-display text-lg font-bold">
                  {data.myRegistration
                    ? "You are registered"
                    : data.registrationOpen
                      ? "Open"
                      : "Closed"}
                </p>
              </div>

              <div className="space-y-6 p-6">
                {data.membershipName && (
                  <p className="text-xs text-muted-foreground">
                    Pricing shown for your <strong>{data.membershipName}</strong> membership.
                  </p>
                )}

                {data.myRegistration ? (
                  <div className="space-y-4">
                    <StatusPill tone="success">{data.myRegistration.status}</StatusPill>
                    <p className="text-sm text-muted-foreground">
                      Paid: {formatMoney(data.myRegistration.pricePaid, data.myRegistration.currency)}
                    </p>
                    <Button asChild variant="outlineInk" className="w-full">
                      <Link to="/account/events">See it in My CometX</Link>
                    </Button>
                  </div>
                ) : tickets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No tickets are on sale for this event.
                  </p>
                ) : (
                  tickets.map((ticket) => (
                    <div key={ticket.id} className="border-t border-border pt-5 first:border-0 first:pt-0">
                      <p className="font-display font-bold">{ticket.name}</p>
                      {ticket.description && (
                        <p className="mt-1 text-xs text-muted-foreground">{ticket.description}</p>
                      )}

                      <div className="mt-3 flex items-baseline gap-3">
                        {ticket.price.includedInMembership ? (
                          <span className="font-display text-xl font-extrabold">Included</span>
                        ) : (
                          <>
                            <span className="font-display text-xl font-extrabold">
                              {formatMoney(ticket.price.finalPrice, ticket.price.currency)}
                            </span>
                            {ticket.price.discount > 0 && (
                              <span className="text-sm text-muted-foreground line-through">
                                {formatMoney(ticket.price.basePrice, ticket.price.currency)}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{ticket.price.reason}</p>
                      <p className="mt-2 text-xs text-muted-foreground">Prototype: registration is saved; no payment is collected.</p>

                      <div className="mt-4">
                        {!user ? (
                          <Button
                            variant="ink"
                            className="w-full"
                            onClick={() =>
                              navigate({ to: "/login", search: { redirect: `/events/${slug}` } })
                            }
                          >
                            Log in to register
                          </Button>
                        ) : !ticket.price.eligible ? (
                          <Button asChild variant="outlineInk" className="w-full">
                            <Link to="/membership">Upgrade membership</Link>
                          </Button>
                        ) : ticket.soldOut || !data.registrationOpen ? (
                          <Button disabled className="w-full" variant="ink">
                            {ticket.soldOut ? "Sold out" : "Registration closed"}
                          </Button>
                        ) : (
                          <Button
                            variant="signal"
                            className="w-full"
                            disabled={reserveMutation.isPending}
                            onClick={() => reserveMutation.mutate(ticket.id)}
                          >
                            {reserveMutation.isPending ? "Reserving..." : "Reserve your place"}
                          </Button>
                        )}
                      </div>

                      {ticket.spotsLeft !== null && ticket.spotsLeft <= 10 && !ticket.soldOut && (
                        <p className="mt-2 text-xs text-destructive">
                          Only {ticket.spotsLeft} places left
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
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
