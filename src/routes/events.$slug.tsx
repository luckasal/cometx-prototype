import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarDays, MapPin, Users } from "lucide-react";
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
  const start = new Date(event.startDate);

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
