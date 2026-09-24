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
import { useLanguage } from "@/contexts/LanguageContext";

export const Route = createFileRoute("/account/events")({
  component: AccountEventsPage,
});

function AccountEventsPage() {
  const { language } = useLanguage();
  const cs = language === "cs";
  const fetchOverview = useServerFn(getAccountOverview);
  const { data, isLoading, error } = useQuery({
    queryKey: ["account"],
    queryFn: () => fetchOverview(),
  });

  return (
    <Section>
      <SectionHeading eyebrow={cs ? "Registrace" : "Registrations"} title={cs ? "Moje akce" : "My events"} />
      {isLoading && <LoadingBlock label={cs ? "Načítáme registrace" : "Loading registrations"} />}
      {error && <ErrorBlock error={error} />}
      {data && data.registrations.length === 0 && (
        <EmptyBlock
          title={cs ? "Zatím nejste na nic registrováni" : "You have not registered for anything yet"}
          hint={cs ? "Prohlédněte si kalendář a rezervujte si místo." : "Browse the calendar and reserve a place."}
        />
      )}
      {data && data.registrations.length > 0 && (
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-paper text-left">
              <tr className="[&>th]:px-5 [&>th]:py-3 [&>th]:text-xs [&>th]:uppercase [&>th]:tracking-widest [&>th]:text-muted-foreground">
                <th>{cs ? "Akce" : "Event"}</th>
                <th>{cs ? "Datum" : "Date"}</th>
                <th>{cs ? "Vstupenka" : "Ticket"}</th>
                <th>{cs ? "Zaplaceno" : "Paid"}</th>
                <th>{cs ? "Stav" : "Status"}</th>
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
                    {new Date(reg.startDate).toLocaleDateString(cs ? "cs-CZ" : "en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="text-muted-foreground">{reg.ticketName ?? "-"}</td>
                  <td>{reg.pricePaid === 0 ? (cs ? "Bez platby" : "No payment collected") : formatMoney(reg.pricePaid, reg.currency)}</td>
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
