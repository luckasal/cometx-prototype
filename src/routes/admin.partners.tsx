import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListPartners } from "@/lib/admin.functions";
import { AdminPage, AdminTable } from "@/components/admin/AdminBits";
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from "@/components/site/Bits";

export const Route = createFileRoute("/admin/partners")({
  component: AdminPartnersPage,
});

function AdminPartnersPage() {
  const fetchPartners = useServerFn(adminListPartners);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "partners"],
    queryFn: () => fetchPartners(),
  });

  return (
    <AdminPage title="Partners" description="Companies supporting CometX events.">
      {isLoading && <LoadingBlock label="Loading partners" />}
      {error && <ErrorBlock error={error} />}
      {data && data.length === 0 && <EmptyBlock title="No partners yet" />}
      {data && data.length > 0 && (
        <AdminTable head={["Name", "Tier", "Website", "Active"]}>
          {data.map((partner) => (
            <tr key={partner.id} className="[&>td]:px-4 [&>td]:py-3">
              <td className="font-medium">{partner.name}</td>
              <td>
                <StatusPill tone="muted">{partner.tier}</StatusPill>
              </td>
              <td className="text-muted-foreground">{partner.website_url ?? "-"}</td>
              <td className="text-muted-foreground">{partner.active ? "Yes" : "No"}</td>
            </tr>
          ))}
        </AdminTable>
      )}
    </AdminPage>
  );
}
