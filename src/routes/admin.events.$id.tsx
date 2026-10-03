import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { adminCheckInEventAttendee, adminGetEvent, adminListEventAttendees } from "@/lib/admin.functions";
import { formatEventLifecycleStatus } from "@/lib/event-admin";
import type { AdminEventMetrics, AdminEventOrderSummary } from "@/lib/event-admin-metrics.server";
import { canCheckInEventTicket, csvCell } from "@/lib/event-attendees";
import { formatMoney } from "@/lib/pricing";
import { AdminPage, AdminTable, inputClass } from "@/components/admin/AdminBits";
import { EventForm, type EventFormValues, type TicketDraft, type WorkshopDraft } from "@/components/admin/EventForm";
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from "@/components/site/Bits";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { EventOrders } from "@/components/admin/EventOrders";

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

function formatRevenue(amounts: Record<string, number> | null) {
  if (!amounts) return "—";
  const entries = Object.entries(amounts);
  return entries.length ? entries.map(([currency, amount]) => formatMoney(amount / 100, currency)).join(" · ") : "—";
}

function EventOverview({ event, metrics, ticketCount }: { event: EventFormValues & { updated_at?: string; event_type: string }; metrics: AdminEventMetrics | null; ticketCount: number }) {
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
  const capacityProgress = metrics && event.capacity.trim() && Number.isFinite(capacity) && capacity > 0
    ? Math.min(metrics.ticketsSold / capacity, 1)
    : null;

  return <div className="space-y-6">
    {!metrics && <p role="status" className="rounded-xl border border-border/60 bg-card px-4 py-3 text-sm text-muted-foreground">Sales and order totals are temporarily unavailable. Event details and editing are still available.</p>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-2xl border border-border/60 bg-card p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Tickets sold</p><p className="mt-2 text-2xl font-bold tabular-nums">{metrics?.ticketsSold ?? "—"}{capacityProgress !== null ? <span className="text-base font-medium text-muted-foreground"> / {capacity}</span> : null}</p>{capacityProgress !== null && <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-accent" style={{ width: `${capacityProgress * 100}%` }} /></div>}{metrics && capacityProgress === null && <p className="mt-2 text-xs text-muted-foreground">No event-wide capacity limit</p>}</div>
      <div className="rounded-2xl border border-border/60 bg-card p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Confirmed revenue</p><p className="mt-2 text-2xl font-bold tabular-nums">{formatRevenue(metrics?.revenueByCurrencyMinor ?? null)}</p><p className="mt-2 text-xs text-muted-foreground">Paid orders and confirmed legacy registrations</p></div>
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
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-display text-lg font-bold">Recent orders</h2><p className="mt-1 text-sm text-muted-foreground">Latest order activity for this event.</p></div><span className="text-xs text-muted-foreground">{metrics ? `${metrics.recentOrders.length} shown` : "Unavailable"}</span></div>
      {!metrics ? <p className="mt-5 rounded-xl bg-background p-4 text-sm text-muted-foreground">Order totals could not be loaded.</p> : metrics.recentOrders.length === 0 ? <p className="mt-5 rounded-xl bg-background p-4 text-sm text-muted-foreground">No orders yet.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[32rem] text-sm"><thead className="text-left text-xs uppercase tracking-widest text-muted-foreground"><tr><th className="py-2 pr-4">Buyer</th><th className="py-2 pr-4">Tickets</th><th className="py-2 pr-4">Total</th><th className="py-2 pr-4">Status</th><th className="py-2">Date</th></tr></thead><tbody className="divide-y divide-border">{metrics.recentOrders.map((order: AdminEventOrderSummary) => <tr key={order.id}><td className="py-3 pr-4">{order.buyerName}</td><td className="py-3 pr-4 tabular-nums">{order.ticketCount}</td><td className="py-3 pr-4">{formatRevenue(order.amountsByCurrencyMinor)}</td><td className="py-3 pr-4 capitalize">{order.status.replaceAll("_", " ")}</td><td className="py-3 text-muted-foreground">{new Date(order.createdAt).toLocaleDateString("en-GB")}</td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}

type EventAttendee = {
  id: string;
  event_id: string;
  order_id: string;
  attendee_name: string;
  attendee_email: string;
  ticket_code: string;
  status: string;
  created_at: string;
  checked_in_at: string | null;
  ticket_orders: { buyer_name: string; buyer_email: string; buyer_kind: string; status: string } | { buyer_name: string; buyer_email: string; buyer_kind: string; status: string }[];
  ticket_order_items: { ticket_name: string } | { ticket_name: string }[];
};

function relationOne<T>(relation: T | T[] | null | undefined): T | null {
  return Array.isArray(relation) ? relation[0] ?? null : relation ?? null;
}

function EventAttendees({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const queryClient = useQueryClient();
  const listAttendees = useServerFn(adminListEventAttendees);
  const checkIn = useServerFn(adminCheckInEventAttendee);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "event-attendees", eventId],
    queryFn: () => listAttendees({ data: { eventId } }),
  });
  const checkInMutation = useMutation({
    mutationFn: (attendeeId: string) => checkIn({ data: { eventId, attendeeId } }),
    onSuccess: (result) => {
      toast.success(result.alreadyCheckedIn ? "Ticket was already checked in" : "Ticket checked in");
      queryClient.invalidateQueries({ queryKey: ["admin", "event-attendees", eventId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const attendees = (data ?? []) as EventAttendee[];
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return attendees.filter((attendee) => {
      if (status !== "all" && attendee.status !== status) return false;
      const order = relationOne(attendee.ticket_orders);
      const ticket = relationOne(attendee.ticket_order_items);
      return !term || [attendee.attendee_name, attendee.attendee_email, attendee.ticket_code, order?.buyer_name, order?.buyer_email, ticket?.ticket_name]
        .some((value) => value?.toLowerCase().includes(term));
    });
  }, [attendees, search, status]);
  const issuedCount = attendees.filter((attendee) => attendee.status === "valid" || attendee.status === "checked_in").length;
  const checkedInCount = attendees.filter((attendee) => attendee.status === "checked_in").length;

  function exportCsv() {
    const header = ["Event", "Attendee", "Attendee email", "Ticket", "Ticket code", "Buyer", "Buyer email", "Buyer type", "Order status", "Ticket status", "Checked in at"];
    const rows = filtered.map((attendee) => {
      const order = relationOne(attendee.ticket_orders);
      const ticket = relationOne(attendee.ticket_order_items);
      return [eventTitle, attendee.attendee_name, attendee.attendee_email, ticket?.ticket_name, attendee.ticket_code, order?.buyer_name, order?.buyer_email, order?.buyer_kind, order?.status, attendee.status, attendee.checked_in_at]
        .map(csvCell).join(",");
    });
    const blob = new Blob([[header.map(csvCell).join(","), ...rows].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${eventTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "event"}-attendees.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-border/60 bg-card p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Issued tickets</p><p className="mt-2 text-2xl font-bold tabular-nums">{issuedCount}</p></div>
      <div className="rounded-2xl border border-border/60 bg-card p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Checked in</p><p className="mt-2 text-2xl font-bold tabular-nums">{checkedInCount}</p></div>
      <div className="rounded-2xl border border-border/60 bg-card p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Roster records</p><p className="mt-2 text-2xl font-bold tabular-nums">{attendees.length}</p></div>
    </div>
    <div className="flex flex-wrap gap-3">
      <input className={`${inputClass} min-w-56 flex-1`} aria-label="Search attendees" placeholder="Search attendee, buyer, ticket code" value={search} onChange={(event) => setSearch(event.target.value)} />
      <select className={inputClass} aria-label="Filter ticket status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All ticket statuses</option>{["valid", "checked_in", "cancelled", "refunded"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>
      <Button type="button" variant="outlineInk" onClick={exportCsv} disabled={!filtered.length}>Export CSV</Button>
    </div>
    {isLoading && <LoadingBlock label="Loading event attendees" />}
    {error && <ErrorBlock error={error} />}
    {data && attendees.length === 0 && <EmptyBlock title="No issued tickets for this event yet" />}
    {data && attendees.length > 0 && filtered.length === 0 && <EmptyBlock title="No matching attendees" />}
    {filtered.length > 0 && <AdminTable head={["Attendee", "Ticket", "Buyer", "Ticket code", "Status", "Check-in"]}>
      {filtered.map((attendee) => {
        const order = relationOne(attendee.ticket_orders);
        const ticket = relationOne(attendee.ticket_order_items);
        return <tr key={attendee.id} className="align-top [&>td]:px-4 [&>td]:py-3">
          <td><strong>{attendee.attendee_name}</strong><span className="block text-xs text-muted-foreground">{attendee.attendee_email}</span></td>
          <td>{ticket?.ticket_name ?? "Ticket"}</td>
          <td><strong>{order?.buyer_name ?? "—"}</strong><span className="block text-xs text-muted-foreground">{order?.buyer_email} · {order?.buyer_kind === "member" ? "Account holder" : "Guest"}</span></td>
          <td><code className="text-xs">{attendee.ticket_code}</code></td>
          <td><StatusPill tone={attendee.status === "valid" || attendee.status === "checked_in" ? "success" : "muted"}>{attendee.status.replaceAll("_", " ")}</StatusPill></td>
          <td>{canCheckInEventTicket(attendee.status, order?.status ?? "") ? <Button size="sm" variant="ink" disabled={checkInMutation.isPending} onClick={() => checkInMutation.mutate(attendee.id)}>Check in</Button> : attendee.checked_in_at ? <span className="text-xs text-muted-foreground">{new Date(attendee.checked_in_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span> : "—"}</td>
        </tr>;
      })}
    </AdminTable>}
    <p className="text-xs text-muted-foreground">This roster includes issued order tickets. Legacy registrations that do not have issued ticket records are not included.</p>
  </div>;
}

function EditEventPage() {
  const { id } = Route.useParams();
  const [tab, setTab] = useState("overview");
  const editing = tab === "tickets" || tab === "settings" || tab === "content";
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
  const metrics = data.metrics as AdminEventMetrics | null;
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
      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        <TabsList aria-label="Event sections" className="h-auto w-full flex-wrap justify-start gap-1">
          {[["overview", "Overview"], ["tickets", "Tickets"], ["settings", "Settings"], ["orders", "Orders"], ["guests", "Guests"], ["emails", "Emails"], ["promotion", "Promotion"], ["analytics", "Analytics"], ["content", "Edit content"]].map(([value, label]) => <TabsTrigger key={value} value={value!}>{label}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="overview"><EventOverview event={{ ...initialEvent, updated_at: e.updated_at }} metrics={metrics} ticketCount={data.tickets.length} /></TabsContent>
        <TabsContent value="orders"><EventOrders eventId={e.id} /></TabsContent>
        <TabsContent value="guests"><EventAttendees eventId={e.id} eventTitle={e.title} /></TabsContent>
        {[
          ["emails", "Emails", "Per-event confirmation, reminder and update email controls are not configured here yet."],
          ["promotion", "Promotion", "Promotion tools are not available here yet. The public or preview link is available in Overview."],
          ["analytics", "Analytics", "Detailed event reports are not available here yet. Existing ticket and revenue totals are in Overview."],
        ].map(([value, title, description]) => <TabsContent key={value} value={value!}><section className="rounded-2xl border border-border/60 bg-card p-6"><h2 className="font-display text-lg font-bold">{title}</h2><p className="mt-3 text-sm text-muted-foreground">{description}</p></section></TabsContent>)}
        {/* Keep one editor mounted across tabs so unsaved values and mutations survive navigation. */}
        <TabsContent forceMount value={editing ? tab : "content"} hidden={!editing}>
          <EventForm initialEvent={initialEvent} initialTickets={initialTickets} initialSpeakerIds={data.speakerIds} initialWorkshops={initialWorkshops} section={tab === "tickets" ? "tickets" : tab === "settings" ? "settings" : "content"} />
        </TabsContent>
      </Tabs>
    </AdminPage>
  );
}
