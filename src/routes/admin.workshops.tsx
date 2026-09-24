import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListWorkshops } from "@/lib/admin.functions";
import { AdminPage, AdminTable } from "@/components/admin/AdminBits";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/site/Bits";
import { formatMoney } from "@/lib/pricing";

export const Route = createFileRoute("/admin/workshops")({
  component: AdminWorkshopsPage,
});

function AdminWorkshopsPage() {
  const fetchWorkshops = useServerFn(adminListWorkshops);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "workshops"],
    queryFn: () => fetchWorkshops(),
  });

  return (
    <AdminPage title="Workshops" description="Sessions attached to events.">
      {isLoading && <LoadingBlock label="Loading workshops" />}
      {error && <ErrorBlock error={error} />}
      {data && data.length === 0 && <EmptyBlock title="No workshops yet" />}
      {data && data.length > 0 && (
        <AdminTable head={["Workshop", "Event", "Leader", "When", "Price"]}>
          {data.map((workshop) => (
            <tr key={workshop.id} className="[&>td]:px-4 [&>td]:py-3">
              <td className="font-medium">{workshop.title}</td>
              <td className="text-muted-foreground">{workshop.events?.title ?? "-"}</td>
              <td className="text-muted-foreground">{workshop.speakers?.name ?? "-"}</td>
              <td className="text-muted-foreground">
                {workshop.start_time
                  ? new Date(workshop.start_time).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "-"}
              </td>
              <td>{formatMoney(Number(workshop.base_price))}</td>
            </tr>
          ))}
        </AdminTable>
      )}
    </AdminPage>
  );
}
