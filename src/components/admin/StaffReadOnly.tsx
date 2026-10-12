import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListEvents,
  adminGetEvent,
  adminListContacts,
  adminListMembers,
  adminListPlans,
} from "@/lib/admin.functions";
import { AdminPage, AdminTable } from "./AdminBits";
import { LoadingBlock, ErrorBlock } from "@/components/site/Bits";
import { Button } from "@/components/ui/button";
import { withRequestTimeout } from "@/lib/request-timeout";

const text = (value: unknown): string => {
  if (value == null) return "—";
  if (typeof value === "object") return "—";
  return String(value);
};

// A genuine read-only view: no forms, role actions, publication controls or mutation handlers.
export function StaffReadOnly({ pathname }: { pathname: string }) {
  const events = useServerFn(adminListEvents);
  const event = useServerFn(adminGetEvent);
  const contacts = useServerFn(adminListContacts);
  const members = useServerFn(adminListMembers);
  const plans = useServerFn(adminListPlans);
  const section = pathname.split("/")[2];
  const id = pathname.split("/")[3];
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["admin", "read-only", pathname],
    retry: false,
    queryFn: () =>
      withRequestTimeout(
        (async () => {
          if (section === "events" && id) {
            const result = await event({ data: { id } });
            return result ? [result.event] : [];
          }
          if (section === "events") return events();
          if (section === "contacts") return contacts({ data: { query: "", status: "all" } });
          if (section === "members") return members();
          if (section === "plans") return plans();
          throw new Error("No read-only view is available for this section.");
        })(),
        15000,
        "Loading records took too long. Please try again.",
      ),
  });
  const columns =
    section === "events"
      ? ["title", "event_type", "start_date", "venue", "publish_state", "event_status"]
      : section === "contacts"
        ? ["first_name", "last_name", "email", "company", "source", "newsletter_status"]
        : section === "members"
          ? ["first_name", "last_name", "email", "company", "planName", "membershipStatus"]
          : ["name", "slug", "annual_price", "currency", "active"];
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  function exportRows() {
    const cell = (value: unknown) => {
      let label = text(value);
      if (/^[=+\-@\t\r]/.test(label)) label = "'" + label;
      return `"${label.replaceAll('"', '""')}"`;
    };
    const csv = [
      columns.map(cell).join(","),
      ...rows.map((row) => columns.map((key) => cell(row[key])).join(",")),
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `cometx-${section}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <AdminPage
      title={`${section === "plans" ? "Memberships" : section} — read only`}
      description="Your role allows viewing and exporting these records, not editing them. Export covers the loaded records only."
      action={
        <Button variant="outlineInk" onClick={exportRows} disabled={!rows.length}>
          Export CSV
        </Button>
      }
    >
      {isLoading && <LoadingBlock label="Loading records" />}
      {error && (
        <>
          <ErrorBlock error={error} />
          <Button onClick={() => refetch()}>Try again</Button>
        </>
      )}
      {data && (
        <>
          <p className="mb-4 text-sm">{rows.length} records loaded.</p>
          <AdminTable head={columns.map((key) => key.replaceAll("_", " "))}>
            {rows.map((row, index) => (
              <tr key={String(row.id ?? index)} className="[&>td]:px-4 [&>td]:py-3">
                {columns.map((key) => (
                  <td key={key}>{text(row[key])}</td>
                ))}
              </tr>
            ))}
          </AdminTable>
        </>
      )}
    </AdminPage>
  );
}
