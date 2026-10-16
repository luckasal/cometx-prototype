export type WorkshopCreditOrder = { status: string; expires_at: string | null };

/** Match the checkout guard's consumption rules, while giving members accurate wording. */
export function workshopCreditState(
  orders: WorkshopCreditOrder[],
  now = Date.now(),
): "available" | "reserved" | "used" {
  if (orders.some((order) => order.status === "confirmed" || order.status === "free")) {
    return "used";
  }
  if (orders.some((order) =>
    order.status === "processing" ||
    order.status === "manual_review" ||
    (order.status === "pending" && !!order.expires_at && Date.parse(order.expires_at) > now)
  )) {
    return "reserved";
  }
  return "available";
}
