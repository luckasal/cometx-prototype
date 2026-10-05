import test from "node:test";
import assert from "node:assert/strict";
import { stripeRequest, StripeRequestError } from "../src/lib/stripe.server.ts";

test("Stripe requests stop waiting and return a safe checkout error on timeout", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.STRIPE_SECRET_KEY;
  const timeoutDescriptor = Object.getOwnPropertyDescriptor(AbortSignal, "timeout");

  process.env.STRIPE_SECRET_KEY = "sk_test_unit_test";
  Object.defineProperty(AbortSignal, "timeout", {
    configurable: true,
    value: () => AbortSignal.abort(new DOMException("Timed out", "TimeoutError")),
  });
  globalThis.fetch = async (_input, init) => {
    if (init.signal.aborted) throw init.signal.reason;
    throw new Error("Expected an already-aborted signal");
  };

  try {
    await assert.rejects(stripeRequest("/prices/price_test"), (error) => {
      assert.ok(error instanceof StripeRequestError);
      assert.equal(error.status, 504);
      assert.match(error.message, /taking too long/i);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
    if (timeoutDescriptor) Object.defineProperty(AbortSignal, "timeout", timeoutDescriptor);
    else delete AbortSignal.timeout;
  }
});
