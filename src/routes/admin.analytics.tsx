import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminAnalytics } from "@/lib/admin-analytics.functions";
import { AdminPage, AdminTable } from "@/components/admin/AdminBits";
import { ErrorBlock, LoadingBlock } from "@/components/site/Bits";

export const Route = createFileRoute("/admin/analytics")({ component: AnalyticsPage });

const ticketSteps = [
  ["Event views", "event_view"],
  ["Ticket selections", "ticket_select"],
  ["Added to cart", "add_to_cart", "ticket_add_to_cart"],
  ["Cart views", "cart_view"],
  ["Checkout starts", "begin_checkout", "checkout_start"],
  ["Confirmed purchases", "purchase", "purchase_success"],
] as const;
const membershipSteps = [
  ["Membership views", "membership_view"],
  ["Plan CTA clicks", "membership_cta_click"],
  ["Membership checkout starts", "membership_checkout_start"],
  ["Membership activations", "membership_activated"],
] as const;

function AnalyticsPage() {
  const fetchAnalytics = useServerFn(getAdminAnalytics);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "analytics"],
    queryFn: () => fetchAnalytics(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  return (
    <AdminPage
      title="Website analytics"
      description="GA4 traffic and conversion activity. Counts are event totals, not unique people."
    >
      {isLoading && <LoadingBlock label="Loading Google Analytics" />}
      {error && <ErrorBlock error={error} />}
      {data && !data.configured && (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm">
          <h2 className="font-semibold">Connect GA4 reporting</h2>
          <p className="mt-2 text-muted-foreground">
            Set GA4_PROPERTY_ID, GA4_CLIENT_EMAIL and GA4_PRIVATE_KEY as server environment
            variables, enable the Google Analytics Data API, and grant the service account Viewer
            access to the property. Traffic reports will appear here after deployment.
          </p>
        </div>
      )}
      {data?.configured && (
        <div className="space-y-8">
          <p className="text-sm text-muted-foreground">
            {data.period} · Consent based GA4 data may be lower than total site traffic.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["Visitors", data.visitors],
              ["Sessions", data.sessions],
              ["Page views", data.pageViews],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-border bg-card p-5">
                <p className="eyebrow text-muted-foreground">{label}</p>
                <p className="mt-3 font-display text-3xl font-extrabold">
                  {Number(value).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
          <div className="grid gap-8 xl:grid-cols-2">
            <ReportTable title="Where visits came from" label="Channel" rows={data.channels} />
            <ReportTable title="Most viewed pages" label="Page" rows={data.pages} />
          </div>
          <div className="grid gap-8 xl:grid-cols-2">
            <FunnelTable title="Ticket journey" steps={ticketSteps} events={data.events} />
            <FunnelTable title="Membership journey" steps={membershipSteps} events={data.events} />
          </div>
          <div className="grid gap-8 xl:grid-cols-2">
            <FunnelTable
              title="Other conversions"
              steps={[
                ["Newsletter signups", "newsletter_signup"],
                ["Outbound links", "outbound_link"],
                ["WhatsApp clicks", "whatsapp_click"],
                ["Logins", "login"],
                ["Signups", "signup"],
              ]}
              events={data.events}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            A dash means this event was not recorded in the selected period. GA4 event counts are
            not a cohort funnel. Payment records remain the source of truth for revenue.
          </p>
        </div>
      )}
    </AdminPage>
  );
}

function ReportTable({
  title,
  label,
  rows,
}: {
  title: string;
  label: string;
  rows: { name: string; count: number }[];
}) {
  return (
    <section>
      <h2 className="mb-4 font-display text-xl font-bold">{title}</h2>
      <AdminTable head={[label, "Count"]}>
        {rows.length ? (
          rows.map((row) => (
            <tr key={row.name}>
              <td className="break-all px-4 py-3">{row.name}</td>
              <td className="px-4 py-3 tabular-nums">{row.count.toLocaleString()}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td className="px-4 py-3" colSpan={2}>
              No data yet.
            </td>
          </tr>
        )}
      </AdminTable>
    </section>
  );
}

function FunnelTable({
  title,
  steps,
  events,
}: {
  title: string;
  steps: readonly (readonly string[])[];
  events: Record<string, number>;
}) {
  return (
    <section>
      <h2 className="mb-4 font-display text-xl font-bold">{title}</h2>
      <AdminTable head={["Step", "Events"]}>
        {steps.map(([label, ...names]) => {
          const count = names.reduce((sum, name) => sum + (events[name] ?? 0), 0);
          return (
            <tr key={label}>
              <td className="px-4 py-3">{label}</td>
              <td className="px-4 py-3 tabular-nums">{count ? count.toLocaleString() : "—"}</td>
            </tr>
          );
        })}
      </AdminTable>
    </section>
  );
}
