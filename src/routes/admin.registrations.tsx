import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListRegistrations } from "@/lib/admin.functions";
import { AdminPage, AdminTable } from "@/components/admin/AdminBits";
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from "@/components/site/Bits";
import { formatMoney } from "@/lib/pricing";

export const Route = createFileRoute("/admin/registrations")({
  component: AdminRegistrationsPage,
});

function AdminRegistrationsPage() {
  const fetchRegistrations = useServerFn(adminListRegistrations);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "registrations"],
    queryFn: () => fetchRegistrations(),
  });

  return (
    <AdminPage title="Registrations" description="Event reservations, newest first. Payment status is tracked separately when Stripe is enabled.">
      {isLoading && <LoadingBlock label="Loading registrations" />}
      {error && <ErrorBlock error={error} />}
      {data && data.length === 0 && <EmptyBlock title="No registrations yet" />}
      {data && data.length > 0 && (
        <AdminTable head={["Attendee", "Event", "Ticket", "Paid", "Status", "Created"]}>
          {data.map((reg) => (
            <tr key={reg.id} className="[&>td]:px-4 [&>td]:py-3">
              <td>
                <span className="font-medium">{reg.attendeeName}</span>
                <span className="block text-xs text-muted-foreground">{reg.attendeeEmail}</span>
              </td>
              <td className="text-muted-foreground">{reg.events?.title ?? "-"}</td>
              <td className="text-muted-foreground">{reg.ticket_types?.name ?? "-"}</td>
              <td>
                {Number(reg.price_paid) === 0
                  ? "No payment collected"
                  : formatMoney(Number(reg.price_paid), reg.currency)}
              </td>
              <td>
                <StatusPill tone={reg.status === "confirmed" ? "success" : "muted"}>
                  {reg.status}
                </StatusPill>
              </td>
              <td className="text-muted-foreground">
                {new Date(reg.created_at).toLocaleDateString("en-GB")}
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </AdminPage>
  );
}
