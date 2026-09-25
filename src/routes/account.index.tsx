import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAccountOverview } from "@/lib/membership.functions";
import { formatMoney } from "@/lib/pricing";
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
  const { data, isLoading, error } = useQuery({
    queryKey: ["account"],
    queryFn: () => fetchOverview(),
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

  const upcomingRegistrations = data.registrations.filter(
    (r) => new Date(r.startDate) >= new Date() && r.status !== "cancelled",
  );

  return (
    <Section>
      <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <SectionHeading
            eyebrow={`Hello ${data.profile.firstName ?? ""}`.trim()}
            title="Your next commitments"
            action={
              <Link to="/account/events" className="text-sm underline underline-offset-4">
                All registrations
              </Link>
            }
          />
          {upcomingRegistrations.length === 0 ? (
            <EmptyBlock
              title="No upcoming registrations"
              hint="Pick something from the calendar - members often pay nothing."
            />
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {upcomingRegistrations.map((reg) => (
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
                    <StatusPill tone={reg.status === "confirmed" ? "success" : "muted"}>
                      {reg.status}
                    </StatusPill>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {reg.pricePaid === 0
                        ? "Included"
                        : formatMoney(reg.pricePaid, reg.currency)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-14">
            <SectionHeading eyebrow="Calendar" title="Coming up for everyone" />
            {data.upcomingEvents.length === 0 ? (
              <EmptyBlock title="Nothing scheduled" />
            ) : (
              <ul className="space-y-3">
                {data.upcomingEvents.map((event) => (
                  <li key={event.slug} className="flex justify-between gap-4 border-b border-border pb-3">
                    <Link
                      to="/events/$slug"
                      params={{ slug: event.slug }}
                      className="text-sm font-medium hover:underline"
                    >
                      {event.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.startDate).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
                      Renews{" "}
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
                    Members pay less for events, get the symposium included and read the full
                    archive.
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
