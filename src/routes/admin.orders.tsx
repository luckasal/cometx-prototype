import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminPage, AdminTable } from "@/components/admin/AdminBits";
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from "@/components/site/Bits";
import { adminListTicketOrders } from "@/lib/admin.functions";
import { formatMoney } from "@/lib/pricing";

export const Route = createFileRoute("/admin/orders")({ component: OrdersPage });

function OrdersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const fetchOrders = useServerFn(adminListTicketOrders);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin", "ticket-orders"], queryFn: () => fetchOrders() });
  const revenue = (data ?? []).filter((order) => order.payments?.some((payment) => payment.status === "paid")).reduce<Record<string, number>>((sum, order) => {
    sum[order.currency] = (sum[order.currency] ?? 0) + Number(order.amount_minor);
    return sum;
  }, {});
  const tickets = (data ?? []).filter((order) => order.status === "confirmed" || order.status === "free")
    .reduce((sum, order) => sum + (order.ticket_order_items ?? []).reduce((lineSum, line) => lineSum + Number(line.quantity), 0), 0);
  const filtered = (data ?? []).filter(order => (!status || order.status === status)
    && [order.id, order.buyer_name, order.buyer_email, order.events?.[0]?.title ?? ""].join(" ").toLowerCase().includes(search.toLowerCase().trim()));

  return <AdminPage title="Orders & attendees" description="Ticket sales and attendee lists. Guest purchases remain contacts, not members.">
    {data && <div className="mb-6 grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl bg-card p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Confirmed revenue</p><p className="mt-2 text-2xl font-bold">{Object.entries(revenue).length ? Object.entries(revenue).map(([currency, amount]) => formatMoney(amount / 100, currency)).join(" · ") : formatMoney(0, "CHF")}</p></div>
      <div className="rounded-2xl bg-card p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Tickets issued</p><p className="mt-2 text-2xl font-bold">{tickets}</p></div>
      <div className="rounded-2xl bg-card p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Orders</p><p className="mt-2 text-2xl font-bold">{data.length}</p></div>
    </div>}
    {isLoading && <LoadingBlock label="Loading ticket orders" />}
    {error && <ErrorBlock error={error} />}
    {data?.length === 0 && <EmptyBlock title="No ticket orders yet" />}
    <div className="mb-5 flex flex-wrap gap-3">
      <label className="flex-1 text-sm">Search orders<input className="mt-2 block min-h-11 w-full rounded-2xl bg-card px-4" placeholder="Order ID, buyer, email or event" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <label className="text-sm">Status<select className="mt-2 block min-h-11 rounded-2xl bg-card px-4" value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option>{["pending","processing","confirmed","free","failed","expired","cancelled","refunded","manual_review"].map(value => <option key={value} value={value}>{value.replaceAll("_"," ")}</option>)}</select></label>
    </div>
    {data && data.length > 0 && filtered.length === 0 && <EmptyBlock title="No matching orders" />}
    {data && data.length > 0 && <AdminTable head={["Buyer / attendees", "Event", "Tickets", "Amount", "Buyer type", "Order / payment", "Created"]}>
      {filtered.map((order) => {
        const count = (order.ticket_order_items ?? []).reduce((sum, item) => sum + Number(item.quantity), 0);
        const attendeeNames = (order.ticket_order_items ?? []).flatMap((item) => item.ticket_attendees ?? []).map((attendee) => attendee.attendee_name);
        const paymentStatus = order.payments?.[0]?.status ?? "—";
        return <tr key={order.id} className="align-top [&>td]:px-4 [&>td]:py-3">
          <td><strong>{order.buyer_name}</strong><span className="block text-xs text-muted-foreground">{order.buyer_email}</span><code className="mt-2 block text-xs">{order.id}</code>{attendeeNames.length > 0 && <details className="mt-3"><summary className="cursor-pointer text-sm">View attendees and ticket codes</summary><ul className="mt-2 space-y-3">{(order.ticket_order_items ?? []).flatMap(item => (item.ticket_attendees ?? []).map(attendee => <li key={attendee.ticket_code} className="text-xs"><strong>{attendee.attendee_name}</strong><span className="block">{item.ticket_name} · {attendee.status}</span><span className="block">{attendee.attendee_email}</span><code className="break-all">{attendee.ticket_code}</code></li>))}</ul></details>}</td>
          <td>{order.events?.[0]?.title ?? "—"}</td>
          <td>{count}{(order.ticket_order_items ?? []).map((item) => <span key={item.ticket_name} className="block text-xs text-muted-foreground">{item.quantity} × {item.ticket_name}</span>)}</td>
          <td>{formatMoney(Number(order.amount_minor) / 100, order.currency)}</td>
          <td><StatusPill tone={order.buyer_kind === "member" ? "success" : "muted"}>{order.buyer_kind === "member" ? "Account holder" : "Guest"}</StatusPill></td>
          <td><StatusPill tone={order.status === "confirmed" || order.status === "free" ? "success" : "muted"}>{order.status}</StatusPill><span className="mt-1 block text-xs text-muted-foreground">Payment: {paymentStatus}</span></td>
          <td className="text-muted-foreground">{new Date(order.created_at).toLocaleDateString("en-GB")}</td>
        </tr>;
      })}
    </AdminTable>}
    <p className="mt-5 text-xs text-muted-foreground">Showing the latest 500 orders. Totals cover those orders. Account holder means the buyer signed in; it does not imply an active membership. Refund and cancellation actions are not enabled in this release.</p>
  </AdminPage>;
}
