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

test("Stripe request encodes dynamic ticket price_data as Checkout line items", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.STRIPE_SECRET_KEY;
  let requestBody = "";
  process.env.STRIPE_SECRET_KEY = "sk_test_unit_test";
  globalThis.fetch = async (_input, init) => {
    requestBody = String(init.body);
    return new Response(JSON.stringify({
      id: "cs_test_dynamic", url: "https://checkout.stripe.com/c/pay/test", livemode: false,
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    await stripeRequest("/checkout/sessions", {
      mode: "payment",
      line_items: [{
        price_data: { currency: "chf", unit_amount: 31500, product_data: { name: "Fixture ticket" } },
        quantity: 2,
      }],
    });
    const fields = new URLSearchParams(requestBody);
    assert.equal(fields.get("line_items[0][price_data][currency]"), "chf");
    assert.equal(fields.get("line_items[0][price_data][unit_amount]"), "31500");
    assert.equal(fields.get("line_items[0][price_data][product_data][name]"), "Fixture ticket");
    assert.equal(fields.get("line_items[0][quantity]"), "2");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
  }
});
