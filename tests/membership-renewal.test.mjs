import assert from "node:assert/strict";
import test from "node:test";
import { membershipRenewalStatus } from "../src/lib/membership-renewal.ts";

const periodEnd = 1822953600;

test("active test subscription shows its item period as the next billing date", () => {
  assert.deepEqual(membershipRenewalStatus({
    status: "active",
    cancel_at_period_end: false,
    items: { data: [{ current_period_end: periodEnd }] },
  }), {
    renewalCancelled: false,
    cancelsAt: null,
    nextBillingAt: new Date(periodEnd * 1000).toISOString(),
  });
});

test("scheduled cancellation shows the end date and no next charge", () => {
  assert.deepEqual(membershipRenewalStatus({
    status: "active",
    cancel_at_period_end: true,
    items: { data: [{ current_period_end: periodEnd }] },
  }), {
    renewalCancelled: true,
    cancelsAt: new Date(periodEnd * 1000).toISOString(),
    nextBillingAt: null,
  });
});

test("explicit cancellation date takes precedence over the period end", () => {
  const cancelAt = periodEnd - 86400;
  assert.deepEqual(membershipRenewalStatus({
    status: "active",
    cancel_at: cancelAt,
    items: { data: [{ current_period_end: periodEnd }] },
  }), {
    renewalCancelled: true,
    cancelsAt: new Date(cancelAt * 1000).toISOString(),
    nextBillingAt: null,
  });
});
