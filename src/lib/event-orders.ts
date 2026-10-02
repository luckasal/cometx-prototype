import { z } from "zod";

export const EVENT_ORDER_STATUSES = [
  "pending",
  "processing",
  "confirmed",
  "free",
  "failed",
  "expired",
  "cancelled",
  "refunded",
  "manual_review",
] as const;
export const EVENT_ORDERS_PAGE_SIZE = 20;
export const eventOrdersInput = z.object({
  eventId: z.string().uuid(),
  search: z.string().trim().max(120).default(""),
  status: z.enum(["all", ...EVENT_ORDER_STATUSES]).default("all"),
  buyerKind: z.enum(["all", "guest", "member"]).default("all"),
  page: z.number().int().min(0).max(100000).default(0),
});
export type EventOrdersInput = z.infer<typeof eventOrdersInput>;

export type EventOrder = {
  id: string;
  buyerName: string;
  buyerEmail: string;
  buyerKind: string;
  status: string;
  createdAt: string;
  orderTotalMinor: number;
  currency: string;
  paymentStatuses: string[];
  lines: {
    id: string;
    name: string;
    quantity: number;
    unitAmountMinor: number;
    amountMinor: number;
    currency: string;
    priceBasis: string;
    attendees: { id: string; name: string; email: string; code: string; status: string }[];
  }[];
};

export function orderStatusLabel(status: string) {
  if (status === "manual_review") return "Needs review";
  if (status === "free") return "Free / included";
  return status.replaceAll("_", " ").replace(/^./, (value) => value.toUpperCase());
}

export function orderPriceBasisLabel(basis: string) {
  if (basis === "member") return "Member price";
  if (basis === "entitlement_free") return "Included benefit";
  if (basis === "public") return "Public price";
  return "Recorded price";
}
