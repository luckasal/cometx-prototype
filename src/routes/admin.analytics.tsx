import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, BarChart3, Eye, MousePointerClick, UsersRound } from "lucide-react";
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
        <AnalyticsPreview />
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

function AnalyticsPreview() {
  const metrics = [
    { label: "Visitors", icon: <UsersRound className="size-5" />, detail: "People who visit your site" },
    { label: "Sessions", icon: <Activity className="size-5" />, detail: "Visits across the selected period" },
    { label: "Page views", icon: <Eye className="size-5" />, detail: "Public pages viewed" },
    { label: "Key actions", icon: <MousePointerClick className="size-5" />, detail: "Ticket and membership events" },
  ];

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 rounded-2xl border border-accent/30 bg-accent/5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent/15 text-accent-foreground">
            <BarChart3 className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold">Analytics dashboard preview</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              This is the prepared dashboard layout. Metrics stay blank until GA4 reporting is connected; no sample traffic is shown.
              The app can collect consented visits with the existing Measurement ID without changing Wix.
            </p>
          </div>
        </div>
        <span className="w-fit shrink-0 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
          Waiting for report data
        </span>
      </section>

      <section aria-label="Traffic overview">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow text-muted-foreground">Website performance</p>
            <h2 className="mt-1 font-display text-xl font-bold">Traffic overview</h2>
          </div>
          <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
            Previous 30 days · preview
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <article key={metric.label} className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="flex items-center justify-between text-muted-foreground">
                <p className="text-sm font-medium">{metric.label}</p>
                <span className="grid size-9 place-items-center rounded-xl bg-accent/10 text-accent-foreground">
                  {metric.icon}
                </span>
              </div>
              <p className="mt-4 font-display text-3xl font-extrabold tracking-tight">—</p>
              <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <EmptyReportPanel title="Traffic over time" description="Daily visits and page views will appear here." />
        <EmptyReportPanel title="Where visits come from" description="Acquisition channels will appear here." />
        <EmptyReportPanel title="Most viewed pages" description="Your top public pages will appear here." />
        <section className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
          <div className="mb-5">
            <p className="eyebrow text-muted-foreground">Conversion journey</p>
            <h2 className="mt-1 font-display text-xl font-bold">Ticket funnel</h2>
          </div>
          <FunnelTable title="" steps={ticketSteps} events={{}} />
        </section>
        <section className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
          <div className="mb-5">
            <p className="eyebrow text-muted-foreground">Member journey</p>
            <h2 className="mt-1 font-display text-xl font-bold">Membership funnel</h2>
          </div>
          <FunnelTable title="" steps={membershipSteps} events={{}} />
        </section>
        <section className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
          <div className="mb-5">
            <p className="eyebrow text-muted-foreground">Engagement</p>
            <h2 className="mt-1 font-display text-xl font-bold">Other conversions</h2>
          </div>
          <FunnelTable title="" steps={[
            ["Newsletter signups", "newsletter_signup"],
            ["Partner clicks", "partner_click"],
            ["WhatsApp clicks", "whatsapp_click"],
            ["Logins", "login"],
            ["Signups", "signup"],
          ]} events={{}} />
        </section>
      </div>
    </div>
  );
}

function EmptyReportPanel({ title, description }: { title: string; description: string }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <div className="mt-5 grid h-44 place-items-center rounded-xl border border-dashed border-border bg-background/60 px-6 text-center">
        <div>
          <BarChart3 className="mx-auto size-7 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">No report data yet</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </section>
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
      {title && <h2 className="mb-4 font-display text-xl font-bold">{title}</h2>}
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
