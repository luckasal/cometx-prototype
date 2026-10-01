import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListEventOrders } from "@/lib/event-orders.functions";
import { EVENT_ORDER_STATUSES, orderPriceBasisLabel, orderStatusLabel } from "@/lib/event-orders";
import type { EventOrder, EventOrdersInput } from "@/lib/event-orders";
import { formatMoney } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { EmptyBlock, LoadingBlock, StatusPill } from "@/components/site/Bits";

function dateTime(value: string) {
  return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function eventSubtotal(order: EventOrder) {
  const amounts = order.lines.reduce<Record<string, number>>((totals, line) => {
    totals[line.currency] = (totals[line.currency] ?? 0) + line.amountMinor;
    return totals;
  }, {});
  return Object.entries(amounts)
    .map(([currency, amount]) => formatMoney(amount / 100, currency))
    .join(" · ");
}

export function EventOrderCard({ order }: { order: EventOrder }) {
  const quantity = order.lines.reduce((sum, line) => sum + line.quantity, 0);
  const payment = order.paymentStatuses.length
    ? order.paymentStatuses.map(orderStatusLabel).join(" · ")
    : order.status === "free"
      ? "No payment required"
      : "No payment recorded";
  return (
    <article className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <h3 className="font-semibold">{order.buyerName}</h3>
          <a
            href={`mailto:${encodeURIComponent(order.buyerEmail)}`}
            className="mt-1 block break-all text-sm text-muted-foreground underline underline-offset-4"
          >
            {order.buyerEmail}
          </a>
          <p className="mt-2 text-xs text-muted-foreground">
            {order.buyerKind === "guest" ? "Guest checkout" : "Signed-in buyer"} ·{" "}
            {dateTime(order.createdAt)}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium">
            {quantity} {quantity === 1 ? "ticket" : "tickets"} for this event
          </p>
          <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
            {order.lines.map((line) => (
              <li key={line.id}>
                {line.quantity} × {line.name}
                <span className="block text-xs">{orderPriceBasisLabel(line.priceBasis)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="sm:col-span-2 xl:col-span-1 xl:text-right">
          <p className="text-lg font-semibold tabular-nums">{eventSubtotal(order)}</p>
          <p className="mb-2 text-xs text-muted-foreground">This event subtotal</p>
          <StatusPill
            tone={order.status === "confirmed" || order.status === "free" ? "success" : "muted"}
          >
            {orderStatusLabel(order.status)}
          </StatusPill>
          <p className="mt-2 text-xs text-muted-foreground">Payment: {payment}</p>
        </div>
      </div>
      <details className="mt-4 border-t border-border/60 pt-4">
        <summary className="cursor-pointer rounded text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2">
          Order details
          <span className="sr-only">
            {" "}
            for {order.buyerName}, {order.id}
          </span>
        </summary>
        <dl className="my-5 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Order reference</dt>
            <dd className="mt-1 break-all font-mono text-xs">{order.id}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Full order total (all events)</dt>
            <dd className="mt-1 font-medium tabular-nums">
              {formatMoney(order.orderTotalMinor / 100, order.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Order status</dt>
            <dd className="mt-1">{orderStatusLabel(order.status)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Payment status (full order)</dt>
            <dd className="mt-1">{payment}</dd>
          </div>
        </dl>
        <p className="mb-3 text-xs text-muted-foreground">
          Tickets below belong to this event. Prices and benefits are recorded at purchase; signing
          in alone does not establish membership.
        </p>
        <div className="space-y-3">
          {order.lines.map((line) => (
            <section key={line.id} className="rounded-xl bg-background p-4">
              <h4 className="text-sm font-semibold">{line.name}</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                {line.quantity} × {formatMoney(line.unitAmountMinor / 100, line.currency)} ={" "}
                {formatMoney(line.amountMinor / 100, line.currency)} ·{" "}
                {orderPriceBasisLabel(line.priceBasis)}
              </p>
              {line.attendees.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No issued tickets recorded for this ticket type.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {line.attendees.map((attendee) => (
                    <li key={attendee.id} className="border-t border-border/60 pt-3 text-sm">
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="font-medium">{attendee.name}</span>
                        <StatusPill>{orderStatusLabel(attendee.status)}</StatusPill>
                      </div>
                      {attendee.email && (
                        <a
                          className="mt-1 block break-all text-xs text-muted-foreground underline"
                          href={`mailto:${encodeURIComponent(attendee.email)}`}
                        >
                          {attendee.email}
                        </a>
                      )}
                      <p className="mt-2 break-all text-xs text-muted-foreground">
                        Ticket code: <code>{attendee.code}</code>
                      </p>
                      <p className="mt-1 break-all text-xs text-muted-foreground">
                        Ticket ID: <code>{attendee.id}</code>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </details>
    </article>
  );
}

const fieldClass =
  "mt-2 block min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-normal";

export function EventOrders({ eventId }: { eventId: string }) {
  const [draftSearch, setDraftSearch] = useState("");
  const [filters, setFilters] = useState<Omit<EventOrdersInput, "eventId">>({
    search: "",
    status: "all",
    buyerKind: "all",
    page: 0,
  });
  const fetchOrders = useServerFn(adminListEventOrders);
  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin", "event-orders", eventId, filters],
    queryFn: () => fetchOrders({ data: { eventId, ...filters } }),
    retry: false,
  });
  const activeFilters = !!filters.search || filters.status !== "all" || filters.buyerKind !== "all";
  return (
    <section className="space-y-5" aria-labelledby="event-orders-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="event-orders-title" className="font-display text-xl font-bold">
            Orders
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Buyers, ticket details and payment status for this event.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          Refresh
        </Button>
      </div>
      <form
        className="grid items-end gap-3 rounded-2xl border border-border/60 bg-card p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_10rem_10rem_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          setFilters((current) => ({ ...current, search: draftSearch.trim(), page: 0 }));
        }}
      >
        <label className="text-sm font-medium">
          Search orders
          <input
            type="search"
            maxLength={120}
            className={fieldClass}
            placeholder="Buyer, email or full order reference"
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
          />
        </label>
        <label className="text-sm font-medium">
          Order status
          <select
            className={fieldClass}
            value={filters.status}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                page: 0,
                status: event.target.value as EventOrdersInput["status"],
              }))
            }
          >
            <option value="all">All statuses</option>
            {EVENT_ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {orderStatusLabel(status)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Buyer
          <select
            className={fieldClass}
            value={filters.buyerKind}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                page: 0,
                buyerKind: event.target.value as EventOrdersInput["buyerKind"],
              }))
            }
          >
            <option value="all">All buyers</option>
            <option value="guest">Guest checkout</option>
            <option value="member">Signed-in buyer</option>
          </select>
        </label>
        <Button type="submit" variant="ink" className="min-h-11">
          Search
        </Button>
      </form>
      {activeFilters && (
        <Button
          type="button"
          variant="link"
          onClick={() => {
            setDraftSearch("");
            setFilters({ search: "", status: "all", buyerKind: "all", page: 0 });
          }}
        >
          Clear filters
        </Button>
      )}
      {isLoading && <LoadingBlock label="Loading event orders" />}
      {error && (
        <div role="alert" className="rounded-xl border border-destructive/40 p-5">
          <p className="text-sm">{error.message}</p>
          <Button
            className="mt-3"
            type="button"
            variant="outline"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            Retry
          </Button>
        </div>
      )}
      {data && !error && (
        <>
          <p role="status" className="text-sm text-muted-foreground">
            {data.total} matching {data.total === 1 ? "order" : "orders"}
            {isFetching ? " · Refreshing…" : ""}
          </p>
          {data.orders.length === 0 && (
            <EmptyBlock
              title={
                activeFilters
                  ? "No matching orders"
                  : data.total
                    ? "No orders on this page"
                    : "No orders yet"
              }
              hint={
                activeFilters
                  ? "Change the search or filters to see more orders."
                  : "Orders will appear here when a checkout is created."
              }
            />
          )}
          <div className="space-y-4">
            {data.orders.map((order) => (
              <EventOrderCard key={order.id} order={order} />
            ))}
          </div>
          {(data.total > data.pageSize || filters.page > 0) && (
            <nav
              aria-label="Orders pagination"
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <Button
                type="button"
                variant="outline"
                disabled={filters.page === 0 || isFetching}
                onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {data.page + 1} of {Math.max(1, Math.ceil(data.total / data.pageSize))}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={(data.page + 1) * data.pageSize >= data.total || isFetching}
                onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
              >
                Next
              </Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
