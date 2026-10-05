import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const db = supabaseAdmin as unknown as SupabaseClient;
const PAGE_SIZE = 500;
const SOLD_ORDER_STATUSES = new Set(["confirmed", "free"]);

export type AdminEventOrderSummary = {
  id: string;
  buyerName: string;
  status: string;
  createdAt: string;
  ticketCount: number;
  amountsByCurrencyMinor: Record<string, number>;
};

export type AdminEventMetrics = {
  ticketsSold: number;
  revenueByCurrencyMinor: Record<string, number>;
  ticketStats: Record<string, { ticketsSold: number; revenueByCurrencyMinor: Record<string, number> }>;
  recentOrders: AdminEventOrderSummary[];
};

type MetricLine = {
  event_id?: string;
  ticket_type_id: string;
  quantity: number;
  amount_minor: number;
  currency: string;
};

type MetricOrder = {
  id: string;
  event_id: string;
  buyer_name: string;
  amount_minor: number;
  currency: string;
  status: string;
  created_at: string;
  ticket_order_items: MetricLine[];
};

function missingLineEventColumn(error: { code?: string; message?: string } | null) {
  return !!error && (
    (error.code === "42703" && /ticket_order_items(?:_\d+)?\.event_id/i.test(error.message ?? "")) ||
    (error.code === "PGRST204" && /event_id/i.test(error.message ?? ""))
  );
}

function addAmount(target: Record<string, number>, currency: string, amountMinor: number) {
  target[currency] = (target[currency] ?? 0) + amountMinor;
}

async function loadOrders(eventIds: string[], withLineEvent: boolean) {
  const orders: MetricOrder[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const itemFields = withLineEvent ? "event_id,ticket_type_id,quantity,amount_minor,currency" : "ticket_type_id,quantity,amount_minor,currency";
    let query = db.from("ticket_orders")
      .select(`id,event_id,buyer_name,amount_minor,currency,status,created_at,ticket_order_items!inner(${itemFields})`);
    query = withLineEvent ? query.in("ticket_order_items.event_id", eventIds) : query.in("event_id", eventIds);
    const result = await query
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (result.error) return { orders: [] as MetricOrder[], error: result.error };
    const page = (result.data ?? []) as unknown as MetricOrder[];
    orders.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return { orders, error: null };
}

/** Aggregate event sales from the order ledger, with a legacy single-event fallback. */
export async function getAdminEventMetrics(eventIds: string[]): Promise<Record<string, AdminEventMetrics>> {
  const metrics: Record<string, AdminEventMetrics> = Object.fromEntries(eventIds.map((id) => [id, {
    ticketsSold: 0,
    revenueByCurrencyMinor: {},
    ticketStats: {},
    recentOrders: [],
  }]));
  if (!eventIds.length) return metrics;

  let orderResult = await loadOrders(eventIds, true);
  if (missingLineEventColumn(orderResult.error)) orderResult = await loadOrders(eventIds, false);
  if (orderResult.error) {
    console.error("[event metrics] Ticket order summary could not be loaded:", orderResult.error.message);
    throw new Error("Event sales could not be loaded. Please try again.");
  }

  for (const order of orderResult.orders) {
    const lines = order.ticket_order_items ?? [];
    const eventLines = new Map<string, MetricLine[]>();
    for (const line of lines) {
      const eventId = line.event_id ?? order.event_id;
      if (!metrics[eventId]) continue;
      const grouped = eventLines.get(eventId) ?? [];
      grouped.push(line);
      eventLines.set(eventId, grouped);
    }

    for (const [eventId, group] of eventLines) {
      const metric = metrics[eventId]!;
      const amounts: Record<string, number> = {};
      let ticketCount = 0;
      for (const line of group) {
        ticketCount += Number(line.quantity);
        addAmount(amounts, line.currency || order.currency, Number(line.amount_minor));
        const ticketStats = metric.ticketStats[line.ticket_type_id] ??= {
          ticketsSold: 0,
          revenueByCurrencyMinor: {},
        };
        if (SOLD_ORDER_STATUSES.has(order.status)) ticketStats.ticketsSold += Number(line.quantity);
        if (order.status === "confirmed") {
          addAmount(metric.revenueByCurrencyMinor, line.currency || order.currency, Number(line.amount_minor));
          addAmount(ticketStats.revenueByCurrencyMinor, line.currency || order.currency, Number(line.amount_minor));
        }
      }
      if (SOLD_ORDER_STATUSES.has(order.status)) metric.ticketsSold += ticketCount;
      metric.recentOrders.push({
        id: order.id,
        buyerName: order.buyer_name,
        status: order.status,
        createdAt: order.created_at,
        ticketCount,
        amountsByCurrencyMinor: amounts,
      });
    }
  }

  let from = 0;
  while (true) {
    const result = await db.from("registrations")
      .select("event_id,ticket_type_id,status,price_paid,currency")
      .in("event_id", eventIds).in("status", ["confirmed", "checked_in"])
      .range(from, from + PAGE_SIZE - 1);
    if (result.error) {
      console.error("[event metrics] Registration summary could not be loaded:", result.error.message);
      throw new Error("Event sales could not be loaded. Please try again.");
    }
    const registrations = result.data ?? [];
    for (const registration of registrations) {
      const metric = metrics[registration.event_id];
      if (!metric) continue;
      metric.ticketsSold += 1;
      addAmount(metric.revenueByCurrencyMinor, registration.currency, Math.round(Number(registration.price_paid ?? 0) * 100));
      if (registration.ticket_type_id) {
        const ticketStats = metric.ticketStats[registration.ticket_type_id] ??= {
          ticketsSold: 0,
          revenueByCurrencyMinor: {},
        };
        ticketStats.ticketsSold += 1;
        addAmount(ticketStats.revenueByCurrencyMinor, registration.currency, Math.round(Number(registration.price_paid ?? 0) * 100));
      }
    }
    if (registrations.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  for (const metric of Object.values(metrics)) {
    metric.recentOrders = metric.recentOrders.slice(0, 5);
  }
  return metrics;
}
