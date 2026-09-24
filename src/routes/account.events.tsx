import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAccountOverview } from "@/lib/membership.functions";
import { formatMoney } from "@/lib/pricing";
import {
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  Section,
  SectionHeading,
  StatusPill,
} from "@/components/site/Bits";

export const Route = createFileRoute("/account/events")({
  component: AccountEventsPage,
});

function AccountEventsPage() {
  const fetchOverview = useServerFn(getAccountOverview);
  const { data, isLoading, error } = useQuery({
    queryKey: ["account"],
    queryFn: () => fetchOverview(),
  });

  return (
    <Section>
      <SectionHeading eyebrow="Registrations" title="My events" />
      {isLoading && <LoadingBlock label="Loading registrations" />}
      {error && <ErrorBlock error={error} />}
      {data && data.registrations.length === 0 && (
        <EmptyBlock
          title="You have not registered for anything yet"
          hint="Browse the calendar and reserve a place."
        />
      )}
      {data && data.registrations.length > 0 && (
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-paper text-left">
              <tr className="[&>th]:px-5 [&>th]:py-3 [&>th]:text-xs [&>th]:uppercase [&>th]:tracking-widest [&>th]:text-muted-foreground">
                <th>Event</th>
                <th>Date</th>
                <th>Ticket</th>
                <th>Paid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.registrations.map((reg) => (
                <tr key={reg.id} className="[&>td]:px-5 [&>td]:py-4">
                  <td>
                    <Link
                      to="/events/$slug"
                      params={{ slug: reg.eventSlug }}
                      className="font-medium hover:underline"
                    >
                      {reg.eventTitle}
                    </Link>
                  </td>
                  <td className="text-muted-foreground">
                    {new Date(reg.startDate).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="text-muted-foreground">{reg.ticketName ?? "-"}</td>
                  <td>{reg.pricePaid === 0 ? "No payment collected" : formatMoney(reg.pricePaid, reg.currency)}</td>
                  <td>
                    <StatusPill tone={reg.status === "confirmed" ? "success" : "muted"}>
                      {reg.status}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
