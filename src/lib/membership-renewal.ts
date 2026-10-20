type StripeSubscription = {
  status?: unknown;
  cancel_at_period_end?: unknown;
  cancel_at?: unknown;
  current_period_end?: unknown;
  items?: { data?: Array<{ current_period_end?: unknown }> };
};

function timestamp(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) return null;
  const date = new Date(value * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** A scheduled cancellation does not revoke access during the paid period. */
export function membershipRenewalStatus(subscription: StripeSubscription) {
  const itemPeriods = (subscription.items?.data ?? [])
    .map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === "number");
  const periodEndsAt = itemPeriods.length ? timestamp(Math.max(...itemPeriods)) : timestamp(subscription.current_period_end);
  const explicitCancelAt = timestamp(subscription.cancel_at);
  const renewalCancelled = subscription.status === "active" &&
    (subscription.cancel_at_period_end === true || explicitCancelAt !== null);
  return {
    renewalCancelled,
    cancelsAt: renewalCancelled ? explicitCancelAt ?? periodEndsAt : null,
    nextBillingAt: subscription.status === "active" && !renewalCancelled ? periodEndsAt : null,
  };
}
