import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EmptyBlock, ErrorBlock, LoadingBlock, Section, SectionHeading, StatusPill } from "@/components/site/Bits";
import { useLanguage } from "@/contexts/LanguageContext";
import { getMyPurchasedTickets } from "@/lib/ticket-orders.functions";
import { formatMoney } from "@/lib/pricing";
import { readTicketCart, writeTicketCart } from "@/lib/ticket-cart";

export const Route = createFileRoute("/account/events")({
  validateSearch: (search: Record<string, unknown>): { purchase?: true; order?: string; batch?: string } => ({
    ...(search["purchase"] === "success" ? { purchase: true as const } : {}),
    ...(typeof search["order"] === "string" ? { order: search["order"] } : {}),
    ...(typeof search["batch"] === "string" ? { batch: search["batch"] } : {}),
  }),
  component: AccountEventsPage,
});

function AccountEventsPage() {
  const { purchase, order: completedOrderId, batch: completedBatchId } = Route.useSearch();
  const { language } = useLanguage();
  const cs = language === "cs";
  const fetchTickets = useServerFn(getMyPurchasedTickets);
  const { data, isLoading, error } = useQuery({
    queryKey: ["account", "tickets"], queryFn: () => fetchTickets(),
    refetchInterval: (query) => query.state.data?.some((order) => order.status === "pending" || order.status === "processing") ? 2500 : false,
  });
  const lines = data?.flatMap((order) => (order.ticket_order_items ?? []).map((item) => ({ order, item }))) ?? [];

  useEffect(() => {
    if (!purchase || (!completedOrderId && !completedBatchId) || !data) return;
    const completed = completedBatchId
      ? data.filter((item) => item.checkout_batch_id === completedBatchId)
      : data.filter((item) => item.id === completedOrderId);
    if (!completed.length || completed.some((item) => !["confirmed", "free"].includes(item.status))) return;
    const eventSlugs = new Set(completed.map((item) => item.events?.[0]?.slug).filter(Boolean));
    writeTicketCart(readTicketCart().filter((line) => !eventSlugs.has(line.eventSlug)));
  }, [purchase, completedOrderId, completedBatchId, data]);

  return <Section>
    <SectionHeading eyebrow={cs ? "Nákupy" : "Purchases"} title={cs ? "Moje vstupenky" : "My tickets"} />
    {isLoading && <LoadingBlock label={cs ? "Načítáme vstupenky" : "Loading tickets"} />}
    {error && <ErrorBlock error={error} />}
    {data && lines.length === 0 && <EmptyBlock title={cs ? "Zatím nemáte žádné zakoupené vstupenky" : "You have no purchased tickets yet"} hint={cs ? "Vyberte akci a kupte si vstupenky online." : "Choose an event and buy tickets online."} />}
    {lines.length > 0 && <div className="space-y-5">{lines.map(({ order, item }) => <article key={item.id} className="rounded-3xl bg-card p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="eyebrow text-muted-foreground">{order.events?.[0]?.start_date ? new Date(order.events[0].start_date).toLocaleDateString(cs ? "cs-CZ" : "en-GB", { dateStyle: "long", timeZone: "Europe/Zurich" }) : "—"}</p>
          <h2 className="mt-2 font-display text-2xl font-bold"><Link className="hover:underline" to="/events/$slug" params={{ slug: order.events?.[0]?.slug ?? "" }}>{order.events?.[0]?.title ?? (cs ? "Akce" : "Event")}</Link></h2>
          <p className="mt-2 text-sm text-muted-foreground">{item.ticket_name} · {item.quantity} {cs ? "vstupenek" : item.quantity === 1 ? "ticket" : "tickets"}</p>
          <p className="mt-2 break-all text-xs text-muted-foreground">{cs ? "Číslo objednávky" : "Order ID"}: {order.id}</p>
        </div>
        <StatusPill tone={order.status === "confirmed" || order.status === "free" ? "success" : "muted"}>{order.status}</StatusPill>
      </div>
      {order.status === "manual_review" && <p className="mt-4 rounded-2xl bg-accent/10 p-4 text-sm">{cs ? "Platba dorazila, ale vstupenky vyžadují kontrolu týmem CometX. Kontaktujte nás s číslem objednávky." : "Payment arrived, but CometX needs to review your tickets. Contact us with your order ID."}</p>}
      {(order.status === "pending" || order.status === "processing") && <p className="mt-4 text-sm text-muted-foreground">{cs ? "Čekáme na potvrzení platby. Stránka se aktualizuje automaticky." : "Waiting for payment confirmation. This page updates automatically."}</p>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-border/40 pt-5 text-sm">
        <p>{order.status === "confirmed" || order.status === "free" ? (cs ? "Zaplaceno" : "Amount paid") : (cs ? "Celkem objednávky" : "Order total")}: <strong>{Number(order.amount_minor) === 0 ? (cs ? "Zdarma" : "Free") : formatMoney(Number(item.unit_amount_minor) * Number(item.quantity) / 100, item.currency)}</strong></p>
        <Link className="rounded-full bg-accent px-5 py-2 font-semibold text-accent-foreground" to="/events/$slug" params={{ slug: order.events?.[0]?.slug ?? "" }}>{cs ? "Koupit další" : "Buy more"}</Link>
      </div>
      {order.status === "confirmed" || order.status === "free" ? <details className="mt-5 rounded-2xl bg-background/60 p-4">
        <summary className="cursor-pointer font-semibold">{cs ? "Zobrazit vstupenky" : "View ticket"}</summary>
        <div className="mt-3 space-y-2">{item.ticket_attendees?.map((ticket) => <div key={ticket.id} className="flex flex-wrap justify-between gap-2 text-sm"><span>{ticket.attendee_name}</span><code>{ticket.ticket_code}</code><span className="text-muted-foreground">{ticket.status}</span></div>)}</div>
      </details> : null}
    </article>)}</div>}
  </Section>;
}
