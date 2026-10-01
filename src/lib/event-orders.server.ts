import type { SupabaseClient } from "@supabase/supabase-js";
import { EVENT_ORDERS_PAGE_SIZE } from "./event-orders.ts";
import type { EventOrder, EventOrdersInput } from "./event-orders.ts";

type OrderRow = {
  id: string;
  event_id: string | null;
  buyer_name: string;
  buyer_email: string;
  buyer_kind: string;
  status: string;
  created_at: string;
  amount_minor: number;
  currency: string;
  payments: { status: string }[];
  ticket_order_items: {
    id: string;
    event_id?: string;
    ticket_name: string;
    quantity: number;
    unit_amount_minor: number;
    amount_minor: number;
    currency: string;
    price_basis: string;
    ticket_attendees: {
      id: string;
      event_id: string;
      attendee_name: string;
      attendee_email: string;
      ticket_code: string;
      status: string;
    }[];
  }[];
};

/** Quote PostgREST filter values, preserving literal search punctuation and wildcard characters. */
function searchFilter(search: string) {
  if (/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(search)) {
    return `id.eq.${search}`;
  }
  const pattern = `%${search.replace(/[\\%_*]/g, "\\$&")}%`;
  const quoted = `"${pattern.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  return `buyer_name.ilike.${quoted},buyer_email.ilike.${quoted}`;
}

function missingLineEvent(error: { code?: string; message?: string } | null) {
  return (
    !!error &&
    ["42703", "PGRST204"].includes(error.code ?? "") &&
    /ticket_order_items/i.test(error.message ?? "") &&
    /event_id/i.test(error.message ?? "")
  );
}

/** Called only after requireAdmin. The injected client stays server-side. */
export async function readEventOrders(db: SupabaseClient, input: EventOrdersInput) {
  const run = async (legacy: boolean) => {
    const lineFields = `${legacy ? "" : "event_id,"}id,ticket_name,quantity,unit_amount_minor,amount_minor,currency,price_basis,ticket_attendees(id,event_id,attendee_name,attendee_email,ticket_code,status)`;
    let query = db
      .from("ticket_orders")
      .select(
        `id,event_id,buyer_name,buyer_email,buyer_kind,status,created_at,amount_minor,currency,payments(status),ticket_order_items!inner(${lineFields})`,
        { count: "exact" },
      )
      .eq(legacy ? "event_id" : "ticket_order_items.event_id", input.eventId);
    if (input.status !== "all") query = query.eq("status", input.status);
    if (input.buyerKind !== "all") query = query.eq("buyer_kind", input.buyerKind);
    if (input.search) query = query.or(searchFilter(input.search));
    const from = input.page * EVENT_ORDERS_PAGE_SIZE;
    return await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + EVENT_ORDERS_PAGE_SIZE - 1);
  };

  let result = await run(false);
  // Migration 0006 stored the event on the parent order. Retry only that known schema difference.
  if (missingLineEvent(result.error)) result = await run(true);
  if (result.error) {
    console.error("[event orders] Read failed", result.error.code);
    throw new Error("Orders could not be loaded. Please try again.");
  }
  const orders: EventOrder[] = ((result.data ?? []) as unknown as OrderRow[])
    .map((order) => ({
      id: order.id,
      buyerName: order.buyer_name,
      buyerEmail: order.buyer_email,
      buyerKind: order.buyer_kind,
      status: order.status,
      createdAt: order.created_at,
      orderTotalMinor: Number(order.amount_minor),
      currency: order.currency,
      paymentStatuses: [...new Set((order.payments ?? []).map((payment) => payment.status))].sort(),
      // Explicit projection: never return guest access tokens or provider identifiers.
      lines: (order.ticket_order_items ?? [])
        .filter((line) => (line.event_id ?? order.event_id) === input.eventId)
        .map((line) => ({
          id: line.id,
          name: line.ticket_name,
          quantity: Number(line.quantity),
          unitAmountMinor: Number(line.unit_amount_minor),
          amountMinor: Number(line.amount_minor),
          currency: line.currency,
          priceBasis: line.price_basis,
          attendees: (line.ticket_attendees ?? [])
            .filter((attendee) => attendee.event_id === input.eventId)
            .map((attendee) => ({
              id: attendee.id,
              name: attendee.attendee_name,
              email: attendee.attendee_email,
              code: attendee.ticket_code,
              status: attendee.status,
            })),
        })),
    }))
    .filter((order) => order.lines.length > 0);
  return { orders, total: result.count ?? 0, page: input.page, pageSize: EVENT_ORDERS_PAGE_SIZE };
}
