import test from "node:test";
import assert from "node:assert/strict";
import {
  assertInvoiceMatchesRequest, createStripeInvoice, findOrCreateInvoiceCustomer, findStripeInvoiceByRequest,
  markStripeInvoicePaidOutside, resolveInvoiceBillingEmail, sendStripeInvoice, verifyPaidCheckoutSession,
} from "../src/lib/stripe-invoicing.server.ts";

async function mockedStripe(handler, run) {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = "sk_test_invoice_fixture";
  globalThis.fetch = async (input, init) => {
    assert.match(String(init.headers.Authorization), /^Bearer sk_test_/);
    const result = await handler(new URL(String(input)), init, new URLSearchParams(String(init.body ?? "")));
    return new Response(JSON.stringify(result), { status: 200, headers: { "content-type": "application/json" } });
  };
  try { await run(); }
  finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = oldKey;
  }
}

const customer = { id: "cus_existing", email: "billing@example.com", name: "Partner AB",
  address: { line1: "Main Street 1", line2: null }, balance: 0, livemode: false };
const invoice = (status = "open") => ({ id: "in_fixture", customer: customer.id, status,
  amount_due: 200000, total: 200000, currency: "chf", livemode: false,
  paid_out_of_band: status === "paid", hosted_invoice_url: "https://invoice.stripe.com/i/test",
  invoice_pdf: "https://pay.stripe.com/invoice/test/pdf", metadata: { kind: "cometx_manual_invoice", cometx_source: "bank", cometx_request_id: "request-1" } });

test("uses saved billing email or requires an admin entry when none exists", () => {
  assert.equal(resolveInvoiceBillingEmail(null, null, "Buyer@Example.com"), "buyer@example.com");
  assert.equal(resolveInvoiceBillingEmail("Accounts@Example.com", null, "buyer@example.com"), "accounts@example.com");
  assert.throws(() => resolveInvoiceBillingEmail(null, null, null), /billing email/i);
});

test("requires invoice metadata and amount to match the saved request", () => {
  const request = { source: "bank", requestId: "request-1", amountMinor: 200000, currency: "CHF" };
  assert.doesNotThrow(() => assertInvoiceMatchesRequest(invoice(), request));
  assert.throws(() => assertInvoiceMatchesRequest(invoice(), { ...request, amountMinor: 199999 }), /does not match/i);
  assert.throws(() => assertInvoiceMatchesRequest({ ...invoice(), metadata: {} }, request), /does not match/i);
});

test("reuses a Stripe Customer only when billing details match", async () => {
  const calls = [];
  await mockedStripe((url, init) => { calls.push([init.method, url.pathname]);
    if (url.pathname === "/v1/customers/cus_existing") return customer;
    throw new Error(`Unexpected ${url.pathname}`);
  }, async () => {
    const result = await findOrCreateInvoiceCustomer({ email: customer.email, name: customer.name,
      address: "Main Street 1", existingId: customer.id, requestKey: "bank-request-1" });
    assert.equal(result.id, customer.id);
  });
  assert.deepEqual(calls, [["GET", "/v1/customers/cus_existing"]]);
});

test("creates a test Customer when none matches the entered billing email", async () => {
  const calls = [];
  await mockedStripe((url, init, body) => { calls.push([init.method, url.pathname, body]);
    if (url.pathname === "/v1/customers" && init.method === "GET") return { data: [] };
    if (url.pathname === "/v1/customers") return customer;
    return { data: [] };
  }, async () => {
    const result = await findOrCreateInvoiceCustomer({ email: customer.email, name: customer.name,
      address: "Main Street 1", requestKey: "bank-request-1" });
    assert.equal(result.id, customer.id);
  });
  assert.equal(calls[0][0], "GET");
  assert.equal(calls[1][0], "POST");
  assert.equal(calls[1][2].get("email"), "billing@example.com");
  assert.equal(calls[1][2].get("address[line1]"), "Main Street 1");
});

test("creates one invoice item and finalizes without a charge; retry uses the existing invoice", async () => {
  const calls = [];
  let lineAdded = false;
  await mockedStripe((url, init, body) => {
    calls.push([init.method, url.pathname, body]);
    if (url.pathname === "/v1/invoices" && init.method === "POST") return invoice("draft");
    if (url.pathname === "/v1/invoices/in_fixture/lines") return { data: lineAdded ? [{ amount: 200000, currency: "chf", metadata: { cometx_invoice_line: "bank-request-1" } }] : [] };
    if (url.pathname === "/v1/invoiceitems") { lineAdded = true; return { id: "ii_fixture" }; }
    if (url.pathname === "/v1/invoices/in_fixture" && init.method === "GET") return invoice(lineAdded ? "draft" : "draft");
    if (url.pathname === "/v1/invoices/in_fixture/finalize") return invoice("open");
    throw new Error(`Unexpected ${url.pathname}`);
  }, async () => {
    const base = { requestKey: "bank-request-1", customerId: customer.id, amountMinor: 200000,
      currency: "CHF", description: "Partner transfer", metadata: invoice().metadata };
    assert.equal((await createStripeInvoice(base)).status, "open");
    assert.equal((await createStripeInvoice({ ...base, existingDraftId: "in_fixture" })).id, "in_fixture");
  });
  assert.equal(calls.filter(([, path]) => path === "/v1/invoices").length, 1);
  assert.equal(calls.filter(([, path]) => path === "/v1/invoiceitems").length, 1);
  assert.ok(calls.every(([, path]) => !path.includes("/checkout/sessions") && !path.includes("payment_intents")));
});

test("recovers an invoice by its CometX request metadata after a lost database write", async () => {
  await mockedStripe((url) => { assert.equal(url.pathname, "/v1/invoices/search");
    assert.match(url.searchParams.get("query"), /cometx_request_id/);
    return { data: [invoice()] };
  }, async () => assert.equal((await findStripeInvoiceByRequest("bank", "request-1"))?.id, "in_fixture"));
});

test("verifies an existing paid Checkout session without creating another payment", async () => {
  const calls = [];
  await mockedStripe((url, init) => { calls.push([init.method, url.pathname]);
    return { livemode: false, payment_status: "paid", payment_intent: "pi_existing", amount_total: 200000, currency: "chf" };
  }, async () => {
    const base = { sessionId: "cs_existing", paymentIntentId: "pi_existing", amountMinor: 200000, currency: "CHF" };
    await verifyPaidCheckoutSession(base);
    await assert.rejects(verifyPaidCheckoutSession({ ...base, amountMinor: 200001 }), /could not be verified/i);
  });
  assert.deepEqual(calls, [["GET", "/v1/checkout/sessions/cs_existing"], ["GET", "/v1/checkout/sessions/cs_existing"]]);
});

test("marks a bank invoice paid out of band with no Checkout or PaymentIntent", async () => {
  const calls = [];
  await mockedStripe((url, init, body) => { calls.push([init.method, url.pathname, body]);
    if (url.pathname.endsWith("/pay")) return invoice("paid");
    return invoice("open");
  }, async () => assert.equal((await markStripeInvoicePaidOutside("in_fixture", "bank-request-1")).status, "paid"));
  assert.equal(calls[1][2].get("paid_out_of_band"), "true");
  assert.ok(calls.every(([, path]) => !path.includes("checkout") && !path.includes("payment_intents")));
});

test("sending a settled invoice uses Stripe Invoicing only", async () => {
  const calls = [];
  await mockedStripe((url, init) => { calls.push([init.method, url.pathname]); return invoice("paid"); },
    async () => assert.equal((await sendStripeInvoice("in_fixture", "bank-request-1")).id, "in_fixture"));
  assert.deepEqual(calls, [["GET", "/v1/invoices/in_fixture"], ["POST", "/v1/invoices/in_fixture/send"]]);
});
