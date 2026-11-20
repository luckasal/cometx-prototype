import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from "@/components/site/Bits";
import { useLanguage } from "@/contexts/LanguageContext";
import { getMyPurchasedTickets } from "@/lib/ticket-orders.functions";
import { formatMoney } from "@/lib/pricing";
import { completePurchasedTicketCart } from "@/lib/ticket-cart";
import { trackConfirmedPaymentFailure, trackConfirmedPurchase } from "@/lib/analytics";
import {
  isCheckoutPendingStatus,
  isIssuedTicketStatus,
  isOwnedOrderLine,
  isOwnedOrderStatus,
} from "@/lib/ticket-status";

export const Route = createFileRoute("/account/events")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { purchase?: true; order?: string; batch?: string } => ({
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
    queryKey: ["account", "tickets"],
    queryFn: () => fetchTickets(),
    refetchInterval: (query) => {
      if (!purchase) return false;
      const targets =
        query.state.data?.filter((order) =>
          completedOrderId
            ? order.id === completedOrderId
            : order.checkout_batch_id === completedBatchId,
        ) ?? [];
      return targets.some((order) => isCheckoutPendingStatus(order.status)) ? 2500 : false;
    },
  });
  const lines =
    data?.flatMap((order) =>
      (order.ticket_order_items ?? [])
        .filter((item) => isOwnedOrderLine(order.status, item.ticket_attendees))
        .map((item) => ({
          order,
          item,
          issuedTickets: item.ticket_attendees.filter((ticket) =>
            isIssuedTicketStatus(ticket.status),
          ),
        })),
    ) ?? [];

  useEffect(() => {
    if (!data) return;
    const recentFailures = data.filter(
      (item) =>
        item.status === "failed" &&
        item.payments?.some((payment) => payment.status === "failed") &&
        Date.now() - Date.parse(item.created_at) < 48 * 60 * 60 * 1000,
    );
    for (const failed of recentFailures)
      trackConfirmedPaymentFailure(failed.checkout_batch_id ?? failed.id, [failed]);
  }, [data]);

  useEffect(() => {
    if (!purchase || (!completedOrderId && !completedBatchId) || !data) return;
    const completed = completedBatchId
      ? data.filter((item) => item.checkout_batch_id === completedBatchId)
      : data.filter((item) => item.id === completedOrderId);
    if (!completed.length || completed.some((item) => !isOwnedOrderStatus(item.status))) return;
    trackConfirmedPurchase(completedBatchId ?? completedOrderId ?? "", completed);
    const purchased = completed.flatMap(
      (item) =>
        item.ticket_order_items?.flatMap((line) =>
          line.events?.[0]?.slug
            ? [
                {
                  eventSlug: line.events[0].slug,
                  ticketId: line.ticket_type_id,
                  quantity: Number(line.quantity),
                },
              ]
            : [],
        ) ?? [],
    );
    completePurchasedTicketCart(completedBatchId ?? completedOrderId ?? "", purchased);
  }, [purchase, completedOrderId, completedBatchId, data]);

  return (
    <main className="min-h-[70vh] bg-muted">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:py-14 lg:px-8 lg:py-16">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow text-muted-foreground">
              CometX · {cs ? "Můj účet" : "My account"}
            </p>
            <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
              {cs ? "Moje vstupenky" : "My tickets"}
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              {cs
                ? "Objednávky a vystavené QR vstupenky na vaše akce."
                : "Your event orders and issued QR tickets."}
            </p>
          </div>
          <Link
            to="/account"
            className="text-sm font-semibold underline decoration-accent decoration-2 underline-offset-4"
          >
            {cs ? "Zpět na přehled" : "Back to overview"} →
          </Link>
        </header>

        <nav
          aria-label={cs ? "Sekce účtu" : "Account sections"}
          className="mb-7 flex flex-wrap gap-2"
        >
          <Link
            to="/account"
            className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold"
          >
            {cs ? "Přehled" : "Overview"}
          </Link>
          <Link
            to="/account/events"
            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-ink-foreground"
            aria-current="page"
          >
            {cs ? "Vstupenky" : "Tickets"}
          </Link>
          <Link
            to="/account/membership"
            className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold"
          >
            {cs ? "Členství" : "Membership"}
          </Link>
          <Link
            to="/account/profile"
            className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold"
          >
            {cs ? "Moje údaje" : "My details"}
          </Link>
        </nav>

        {purchase && (
          <div
            role="status"
            className="mb-6 rounded-2xl border border-accent/40 bg-card p-5 sm:p-6"
          >
            <p className="font-display text-lg font-bold">
              {cs ? "Ověřujeme potvrzení platby" : "Confirming your payment"}
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {cs
                ? "Vstupenky a QR kódy se zobrazí po potvrzení objednávky od Stripe. Pokud se stav za chvíli nezmění, obnovte stránku. Platbu neopakujte."
                : "Tickets and QR codes appear after Stripe confirms the order. Refresh shortly if the status has not updated. Please do not pay again."}
            </p>
          </div>
        )}

        <section
          className="rounded-3xl bg-card p-5 sm:p-8"
          aria-label={cs ? "Vstupenky" : "Tickets"}
        >
          {isLoading && <LoadingBlock label={cs ? "Načítáme vstupenky" : "Loading tickets"} />}
          {error && <ErrorBlock error={error} />}
          {data && lines.length === 0 && (
            <EmptyBlock
              title={
                purchase
                  ? cs
                    ? "Objednávka se ještě zpracovává"
                    : "Your order is still processing"
                  : cs
                    ? "Zatím nemáte žádné zakoupené vstupenky"
                    : "You have no purchased tickets yet"
              }
              hint={
                purchase
                  ? cs
                    ? "Potvrzení platby může chvíli trvat. Vstupenky se zobrazí automaticky po ověření."
                    : "Payment confirmation can take a moment. Tickets will appear automatically after verification."
                  : cs
                    ? "Vyberte akci a kupte si vstupenky online."
                    : "Choose an event and buy tickets online."
              }
            />
          )}
          {lines.length > 0 && (
            <div className="space-y-5">
              {lines.map(({ order, item, issuedTickets }) => (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-2xl border border-border bg-background"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
                    <div>
                      <p className="eyebrow text-muted-foreground">
                        {item.events?.[0]?.start_date
                          ? new Date(item.events[0].start_date).toLocaleDateString(
                              cs ? "cs-CZ" : "en-GB",
                              { dateStyle: "long", timeZone: "Europe/Zurich" },
                            )
                          : "—"}
                      </p>
                      <h2 className="mt-2 font-display text-2xl font-bold">
                        <Link
                          className="hover:underline"
                          to="/events/$slug"
                          params={{ slug: item.events?.[0]?.slug ?? "" }}
                        >
                          {item.events?.[0]?.title ?? (cs ? "Akce" : "Event")}
                        </Link>
                      </h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {item.ticket_name} · {issuedTickets.length}{" "}
                        {cs ? "vstupenek" : issuedTickets.length === 1 ? "ticket" : "tickets"}
                      </p>
                      <p className="mt-2 break-all text-xs text-muted-foreground">
                        {cs ? "Číslo objednávky" : "Order ID"}: {order.id}
                      </p>
                    </div>
                    <StatusPill tone="success">{order.status}</StatusPill>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-5 py-4 text-sm sm:px-6">
                    <p>
                      {cs ? "Cena vstupenek" : "Ticket total"}:{" "}
                      <strong>
                        {Number(item.unit_amount_minor) === 0
                          ? cs
                            ? "Zdarma"
                            : "Free"
                          : formatMoney(
                              (Number(item.unit_amount_minor) * issuedTickets.length) / 100,
                              item.currency,
                            )}
                      </strong>
                    </p>
                    <Link
                      className="font-semibold underline decoration-accent decoration-2 underline-offset-4"
                      to="/events/$slug"
                      params={{ slug: item.events?.[0]?.slug ?? "" }}
                    >
                      {cs ? "Detail akce" : "Event details"} →
                    </Link>
                  </div>
                  <div className="border-t border-border bg-muted/50 p-5 sm:p-6">
                    <h3 className="font-display text-lg font-bold">
                      {cs ? "Vstupenky a QR kódy" : "Tickets and QR codes"}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {cs
                        ? "Ukažte QR kód při vstupu na akci."
                        : "Show the QR code at the event entrance."}
                    </p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      {issuedTickets.map((ticket) => (
                        <div
                          key={ticket.id}
                          className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 text-sm"
                        >
                          <div className="shrink-0 rounded-xl bg-white p-2">
                            <QRCodeSVG
                              value={ticket.ticket_code}
                              size={112}
                              level="M"
                              title={`${cs ? "QR kód vstupenky" : "Ticket QR code"} · ${ticket.attendee_name}`}
                            />
                          </div>
                          <div className="min-w-0">
                            <strong>{ticket.attendee_name}</strong>
                            <code className="mt-2 block break-all text-xs">
                              {ticket.ticket_code}
                            </code>
                            <span className="mt-2 block text-muted-foreground">
                              {ticket.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
