import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EmptyBlock, ErrorBlock, LoadingBlock, Section, SectionHeading, StatusPill } from "@/components/site/Bits";
import { useLanguage } from "@/contexts/LanguageContext";
import { getMyPurchasedTickets } from "@/lib/ticket-orders.functions";
import { formatMoney } from "@/lib/pricing";

export const Route = createFileRoute("/account/events")({ component: AccountEventsPage });

function AccountEventsPage() {
  const { language } = useLanguage();
  const cs = language === "cs";
  const fetchTickets = useServerFn(getMyPurchasedTickets);
  const { data, isLoading, error } = useQuery({
    queryKey: ["account", "tickets"], queryFn: () => fetchTickets(),
    refetchInterval: (query) => query.state.data?.some((order) => order.status === "pending" || order.status === "processing") ? 2500 : false,
  });
  const lines = data?.flatMap((order) => (order.ticket_order_items ?? []).map((item) => ({ order, item }))) ?? [];

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
        </div>
        <StatusPill tone={order.status === "confirmed" || order.status === "free" ? "success" : "muted"}>{order.status}</StatusPill>
      </div>
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
