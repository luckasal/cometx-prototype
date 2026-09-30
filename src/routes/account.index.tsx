import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAccountOverview } from "@/lib/membership.functions";
import { getMyPurchasedTickets } from "@/lib/ticket-orders.functions";
import { formatMoney } from "@/lib/pricing";
import { isIssuedTicketStatus, isOwnedOrderLine, isOwnedRegistrationStatus, isUpcomingEvent } from "@/lib/ticket-status";
import { Button } from "@/components/ui/button";
import {
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  Section,
  SectionHeading,
  StatusPill,
} from "@/components/site/Bits";

export const Route = createFileRoute("/account/")({
  component: AccountOverviewPage,
});

function benefitLabel(b: { key: string; name: string; value: number | null }) {
  if (b.value === null) return b.name;
  if (b.key.endsWith("_discount")) return `${b.name}: ${b.value}%`;
  if (b.key.endsWith("_credit")) return `${b.name}: CHF ${b.value}`;
  return b.name;
}

function AccountOverviewPage() {
  const fetchOverview = useServerFn(getAccountOverview);
  const fetchTickets = useServerFn(getMyPurchasedTickets);
  const { data, isLoading, error } = useQuery({
    queryKey: ["account"],
    queryFn: () => fetchOverview(),
  });
  const { data: orders, error: ticketError, isLoading: ticketsLoading } = useQuery({
    queryKey: ["account", "tickets"],
    queryFn: () => fetchTickets(),
  });

  if (isLoading)
    return (
      <Section>
        <LoadingBlock label="Loading your account" />
      </Section>
    );
  if (error)
    return (
      <Section>
        <ErrorBlock error={error} />
      </Section>
    );
  if (!data) return null;

  const upcomingEvents = [
    ...data.registrations.filter((reg) => isOwnedRegistrationStatus(reg.status) && isUpcomingEvent(reg.startDate)).map((reg) => ({
      id: `registration:${reg.id}`, eventTitle: reg.eventTitle, eventSlug: reg.eventSlug,
      startDate: reg.startDate, ticketName: reg.ticketName, status: reg.status,
      amount: reg.pricePaid, currency: reg.currency,
    })),
    ...(orders ?? []).flatMap((order) =>
      (order.ticket_order_items ?? []).filter((item) => isOwnedOrderLine(order.status, item.ticket_attendees) && !!item.events?.[0]?.start_date && isUpcomingEvent(item.events[0].start_date)).map((item) => ({
        id: `ticket:${item.id}`, eventTitle: item.events[0]!.title, eventSlug: item.events[0]!.slug,
        startDate: item.events[0]!.start_date, ticketName: item.ticket_name, status: order.status,
        amount: Number(item.unit_amount_minor) * (item.ticket_attendees?.filter((ticket) => isIssuedTicketStatus(ticket.status)).length ?? 0) / 100,
        currency: item.currency,
      }))),
  ].sort((left, right) => Date.parse(left.startDate) - Date.parse(right.startDate));

  return (
    <Section>
      <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <SectionHeading
            eyebrow={`Hello ${data.profile.firstName ?? ""}`.trim()}
            title="Upcoming confirmed events"
            action={
              <Link to="/account/events" className="text-sm underline underline-offset-4">
                My events
              </Link>
            }
          />
          {ticketError && <ErrorBlock error={ticketError} />}
          {ticketsLoading && upcomingEvents.length === 0 ? (
            <LoadingBlock label="Loading your tickets" />
          ) : upcomingEvents.length === 0 && !ticketError ? (
            <EmptyBlock
              title="No upcoming confirmed events"
              hint="Browse CometX events to find your next gathering."
            />
          ) : upcomingEvents.length > 0 ? (
            <ul className="divide-y divide-border border-y border-border">
              {upcomingEvents.map((reg) => (
                <li key={reg.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
                  <div>
                    <Link
                      to="/events/$slug"
                      params={{ slug: reg.eventSlug }}
                      className="font-display text-lg font-bold hover:underline"
                    >
                      {reg.eventTitle}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(reg.startDate).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                      {reg.ticketName ? ` - ${reg.ticketName}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <StatusPill tone="success">
                      {reg.status}
                    </StatusPill>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {reg.amount === 0 ? "Free" : formatMoney(reg.amount, reg.currency)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

        </div>

        <aside className="space-y-6">
          <div className="overflow-hidden rounded-3xl border border-ink/40">
            <div className="bg-ink px-6 py-4 text-ink-foreground">
              <p className="eyebrow text-accent">Membership</p>
              <p className="mt-1 font-display text-xl font-extrabold">
                {data.membership ? data.membership.planName : "No active membership"}
              </p>
            </div>
            <div className="space-y-4 p-6">
              {data.membership ? (
                <>
                  <StatusPill tone="success">{data.membership.status}</StatusPill>
                  {data.membership.endsAt && (
                    <p className="text-xs text-muted-foreground">
                      Valid until{" "}
                      {new Date(data.membership.endsAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  )}
                  <ul className="space-y-2 border-t border-border pt-4 text-sm">
                    {data.membership.benefits.map((benefit) => (
                      <li key={benefit.key}>{benefitLabel(benefit)}</li>
                    ))}
                  </ul>
                  <Button asChild variant="outlineInk" className="w-full">
                    <Link to="/account/membership">Membership details</Link>
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Explore the CometX plans and choose the membership that suits you.
                  </p>
                  <Button asChild variant="signal" className="w-full">
                    <Link to="/membership">Become a member</Link>
                  </Button>
                </>
              )}
            </div>
          </div>

          {data.isAdmin && (
            <div className="rounded-2xl border border-border/60 p-6">
              <p className="eyebrow text-muted-foreground">Staff</p>
              <p className="mt-2 text-sm text-muted-foreground">
                You have admin access to the CometX back office.
              </p>
              <Button asChild variant="ink" className="mt-4 w-full">
                <Link to="/admin">Open admin</Link>
              </Button>
            </div>
          )}
        </aside>
      </div>
    </Section>
  );
}
