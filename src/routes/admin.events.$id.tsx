import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { adminGetEvent } from "@/lib/admin.functions";
import { formatEventLifecycleStatus } from "@/lib/event-admin";
import type { AdminEventMetrics, AdminEventOrderSummary } from "@/lib/event-admin-metrics.server";
import { formatMoney } from "@/lib/pricing";
import { AdminPage } from "@/components/admin/AdminBits";
import { EventForm, type EventFormValues, type TicketDraft, type WorkshopDraft } from "@/components/admin/EventForm";
import { ErrorBlock, LoadingBlock, StatusPill } from "@/components/site/Bits";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/events/$id")({
  component: EditEventPage,
});

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDateRange(start: string, end: string | null) {
  const startDate = new Date(start);
  const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short" });
  const startText = dateTime.format(startDate);
  if (!end) return startText;
  const endDate = new Date(end);
  const sameDay = startDate.toDateString() === endDate.toDateString();
  const endText = sameDay
    ? new Intl.DateTimeFormat("en-GB", { timeStyle: "short" }).format(endDate)
    : dateTime.format(endDate);
  return `${startText}–${endText}`;
}

function formatRevenue(amounts: Record<string, number>) {
  const entries = Object.entries(amounts);
  return entries.length ? entries.map(([currency, amount]) => formatMoney(amount / 100, currency)).join(" · ") : "—";
}

function EventOverview({ event, metrics, ticketCount }: { event: EventFormValues & { updated_at?: string; event_type: string }; metrics: AdminEventMetrics; ticketCount: number }) {
  const eventUrl = `/events/${encodeURIComponent(event.slug)}`;
  const publicEvent = event.publish_state === "published";
  const checks = [
    ["Event title", !!event.title.trim()],
    ["Public URL", !!event.slug.trim()],
    ["Date and time", !!event.start_date && Number.isFinite(Date.parse(event.start_date))],
    ["Location", !!(event.venue.trim() || event.address.trim())],
    ["Description", !!event.short_description.trim() || !!event.description.trim()],
    ["Event image", !!event.hero_image_url.trim()],
    ["At least one ticket type", ticketCount > 0],
  ] as const;
  const readyCount = checks.filter(([, ready]) => ready).length;
  const capacity = Number(event.capacity);
  const capacityProgress = event.capacity.trim() && Number.isFinite(capacity) && capacity > 0
    ? Math.min(metrics.ticketsSold / capacity, 1)
    : null;

  return <div className="space-y-6">
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-2xl border border-border/60 bg-card p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Tickets sold</p><p className="mt-2 text-2xl font-bold tabular-nums">{metrics.ticketsSold}{capacityProgress !== null ? <span className="text-base font-medium text-muted-foreground"> / {capacity}</span> : null}</p>{capacityProgress !== null && <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-accent" style={{ width: `${capacityProgress * 100}%` }} /></div>}{capacityProgress === null && <p className="mt-2 text-xs text-muted-foreground">No event-wide capacity limit</p>}</div>
      <div className="rounded-2xl border border-border/60 bg-card p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Confirmed revenue</p><p className="mt-2 text-2xl font-bold tabular-nums">{formatRevenue(metrics.revenueByCurrencyMinor)}</p><p className="mt-2 text-xs text-muted-foreground">Paid orders and confirmed legacy registrations</p></div>
      <div className="rounded-2xl border border-border/60 bg-card p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Publication</p><div className="mt-3"><StatusPill tone={publicEvent ? "signal" : "muted"}>{formatEventLifecycleStatus(event.publish_state)}</StatusPill></div><p className="mt-2 text-sm capitalize text-muted-foreground">Event status: {event.event_status.replaceAll("_", " ")}</p></div>
      <div className="rounded-2xl border border-border/60 bg-card p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Setup</p><p className="mt-2 text-2xl font-bold tabular-nums">{readyCount} / 7</p><p className="mt-2 text-xs text-muted-foreground">Content checks complete · publication is shown separately</p></div>
    </section>

    <section className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
      <div className="rounded-2xl border border-border/60 bg-card p-6">
        <h2 className="font-display text-lg font-bold">Event details</h2>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-widest text-muted-foreground">Date and time</dt><dd className="mt-1">{formatDateRange(event.start_date, event.end_date || null)}</dd></div>
          <div><dt className="text-xs uppercase tracking-widest text-muted-foreground">Location</dt><dd className="mt-1">{event.venue || "—"}{event.address && <span className="block text-sm text-muted-foreground">{event.address}</span>}</dd></div>
          <div><dt className="text-xs uppercase tracking-widest text-muted-foreground">Event type</dt><dd className="mt-1 capitalize">{event.event_type.replaceAll("_", " ")}</dd></div>
          <div><dt className="text-xs uppercase tracking-widest text-muted-foreground">Capacity</dt><dd className="mt-1">{event.capacity || "Unlimited"}</dd></div>
          <div><dt className="text-xs uppercase tracking-widest text-muted-foreground">Last modified</dt><dd className="mt-1">{event.updated_at ? new Date(event.updated_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—"}</dd></div>
        </dl>
        <div className="mt-6 flex flex-wrap gap-3 border-t border-border/60 pt-5">
          <a href={publicEvent ? eventUrl : `${eventUrl}?preview=1`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded-full bg-ink px-4 text-sm font-semibold text-ink-foreground hover:opacity-90">{publicEvent ? "Open public event" : "Preview event"}</a>
          {publicEvent && <a href={eventUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded-full border border-border px-4 text-sm underline-offset-4 hover:underline">/events/{event.slug}</a>}
        </div>
      </div>
      <div className="rounded-2xl border border-border/60 bg-card p-6">
        <div className="flex items-center justify-between gap-3"><h2 className="font-display text-lg font-bold">Setup completeness</h2><span className="text-sm tabular-nums text-muted-foreground">{readyCount} of 7</span></div>
        <ul className="mt-4 space-y-3">{checks.map(([label, ready]) => <li key={label} className="flex items-center gap-3 text-sm"><span aria-label={ready ? "Complete" : "Needs attention"} className={ready ? "grid size-5 place-items-center rounded-full bg-success/15 text-success" : "grid size-5 place-items-center rounded-full bg-muted text-muted-foreground"}>{ready ? "✓" : "·"}</span><span className={ready ? "" : "text-muted-foreground"}>{label}</span></li>)}</ul>
      </div>
    </section>

    <section className="rounded-2xl border border-border/60 bg-card p-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-display text-lg font-bold">Recent orders</h2><p className="mt-1 text-sm text-muted-foreground">Latest order activity for this event.</p></div><span className="text-xs text-muted-foreground">{metrics.recentOrders.length} shown</span></div>
      {metrics.recentOrders.length === 0 ? <p className="mt-5 rounded-xl bg-background p-4 text-sm text-muted-foreground">No orders yet.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[32rem] text-sm"><thead className="text-left text-xs uppercase tracking-widest text-muted-foreground"><tr><th className="py-2 pr-4">Buyer</th><th className="py-2 pr-4">Tickets</th><th className="py-2 pr-4">Total</th><th className="py-2 pr-4">Status</th><th className="py-2">Date</th></tr></thead><tbody className="divide-y divide-border">{metrics.recentOrders.map((order: AdminEventOrderSummary) => <tr key={order.id}><td className="py-3 pr-4">{order.buyerName}</td><td className="py-3 pr-4 tabular-nums">{order.ticketCount}</td><td className="py-3 pr-4">{formatRevenue(order.amountsByCurrencyMinor)}</td><td className="py-3 pr-4 capitalize">{order.status.replaceAll("_", " ")}</td><td className="py-3 text-muted-foreground">{new Date(order.createdAt).toLocaleDateString("en-GB")}</td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}

function EditEventPage() {
  const { id } = Route.useParams();
  const fetchEvent = useServerFn(adminGetEvent);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "event", id],
    queryFn: () => fetchEvent({ data: { id } }),
  });

  if (isLoading)
    return (
      <AdminPage title="Edit event">
        <LoadingBlock label="Loading event" />
      </AdminPage>
    );
  if (error)
    return (
      <AdminPage title="Edit event">
        <ErrorBlock error={error} />
      </AdminPage>
    );
  if (!data?.event)
    return (
      <AdminPage title="Edit event">
        <p className="text-sm text-muted-foreground">This event no longer exists.</p>
      </AdminPage>
    );

  const e = data.event;
  const metrics = data.metrics as AdminEventMetrics;
  const initialEvent: EventFormValues = {
    id: e.id,
    title: e.title,
    event_type: e.event_type,
    slug: e.slug,
    short_description: e.short_description ?? "",
    description: e.description ?? "",
    hero_image_url: e.hero_image_url ?? "",
    gallery_urls: Array.isArray(e.gallery_urls) ? e.gallery_urls.filter((url): url is string => typeof url === "string").join("\n") : "",
    start_date: toLocalInput(e.start_date),
    end_date: toLocalInput(e.end_date),
    venue: e.venue ?? "",
    address: e.address ?? "",
    capacity: e.capacity === null ? "" : String(e.capacity),
    registration_start: toLocalInput(e.registration_start),
    registration_end: toLocalInput(e.registration_end),
    publish_state: e.publish_state,
    event_status: e.event_status,
    featured: !!e.featured,
  };

  const initialTickets: TicketDraft[] = data.tickets.map((ticket) => ({
    id: ticket.id,
    name: ticket.name,
    description: ticket.description ?? "",
    base_price: String(Number(ticket.base_price)),
    member_price: ticket.member_price === null ? "" : String(ticket.member_price),
    sale_start: toLocalInput(ticket.sale_start),
    sale_end: toLocalInput(ticket.sale_end),
    currency: ticket.currency,
    capacity: ticket.capacity === null ? "" : String(ticket.capacity),
    required_entitlement: ticket.required_entitlement ?? "",
    discount_entitlement: ticket.discount_entitlement ?? "",
    free_entitlement: ticket.free_entitlement ?? "",
  }));
  const initialWorkshops: WorkshopDraft[] = data.workshops.map((workshop) => ({
    id: workshop.id, title: workshop.title, description: workshop.description ?? "", speaker_id: workshop.speaker_id ?? "", start_time: toLocalInput(workshop.start_time), end_time: toLocalInput(workshop.end_time), location: workshop.location ?? "", capacity: workshop.capacity === null ? "" : String(workshop.capacity), base_price: String(Number(workshop.base_price)), separate_registration_required: workshop.separate_registration_required,
  }));

  return (
    <AdminPage title={e.title} description={`Event workspace · /events/${e.slug}`}>
      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList aria-label="Event sections" className="h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="edit">Edit event</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><EventOverview event={initialEvent} metrics={metrics} ticketCount={data.tickets.length} /></TabsContent>
        <TabsContent value="edit"><p className="mb-5 text-sm text-muted-foreground">Save changes before refreshing the public preview.</p><EventForm initialEvent={initialEvent} initialTickets={initialTickets} initialSpeakerIds={data.speakerIds} initialWorkshops={initialWorkshops} /></TabsContent>
      </Tabs>
    </AdminPage>
  );
}
