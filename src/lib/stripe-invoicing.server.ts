import { stripeRequest } from "./stripe.server.ts";

export type StripeInvoice = {
  id: string;
  customer: string;
  status: "draft" | "open" | "paid" | "void" | "uncollectible";
  paid_out_of_band: boolean;
  amount_due: number;
  total: number;
  currency: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  livemode: boolean;
  metadata: Record<string, string>;
};

type StripeCustomer = { id: string; email: string | null; name: string | null; address: { line1?: string | null; line2?: string | null } | null; balance: number; deleted?: boolean; livemode: boolean };

function assertTestCustomer(customer: StripeCustomer) {
  if (customer.deleted || customer.livemode || !customer.id.startsWith("cus_")) throw new Error("Stripe returned an invalid test Customer.");
  return customer;
}

export function resolveInvoiceBillingEmail(entered?: string | null, saved?: string | null, fallback?: string | null): string {
  const email = (entered || saved || fallback || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error("Enter a valid billing email before creating this invoice.");
  }
  return email;
}

export async function findOrCreateInvoiceCustomer(input: {
  email: string; name: string; address: string; existingId?: string | null; requestKey: string;
}): Promise<StripeCustomer> {
  const addressLines = input.address.trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const address = { line1: (addressLines[0] ?? input.address).slice(0, 500), line2: addressLines.slice(1).join(", ").slice(0, 500) || undefined };
  const matchesBilling = (customer: StripeCustomer) => customer.email?.toLowerCase() === input.email.toLowerCase()
    && customer.name === input.name && customer.address?.line1 === address.line1
    && (customer.address?.line2 || "") === (address.line2 || "");
  if (input.existingId) {
    const existing = await stripeRequest<StripeCustomer>(`/customers/${encodeURIComponent(input.existingId)}`);
    if (existing.deleted || existing.livemode || existing.balance !== 0 || !matchesBilling(existing)) {
      throw new Error("The saved Stripe customer does not match the invoice billing details.");
    }
    return assertTestCustomer(existing);
  }
  const candidates = await stripeRequest<{ data: StripeCustomer[] }>(`/customers?email=${encodeURIComponent(input.email)}&limit=100`);
  const found = candidates.data.find((customer) => !customer.deleted && !customer.livemode && customer.balance === 0 && matchesBilling(customer));
  if (found) return assertTestCustomer(found);
  return assertTestCustomer(await stripeRequest<StripeCustomer>("/customers", {
    email: input.email, name: input.name,
    address,
    metadata: { cometx_invoice_request: input.requestKey },
  }, `cometx-customer-${input.requestKey}`));
}

export async function retrieveStripeInvoice(id: string): Promise<StripeInvoice> {
  const invoice = await stripeRequest<StripeInvoice>(`/invoices/${encodeURIComponent(id)}`);
  if (invoice.livemode) throw new Error("Live Stripe invoices cannot be managed from this test-mode app.");
  return invoice;
}

export async function findStripeInvoiceByRequest(source: "bank" | "ticket", requestId: string): Promise<StripeInvoice | null> {
  const query = `metadata['cometx_source']:'${source}' AND metadata['cometx_request_id']:'${requestId}'`;
  const result = await stripeRequest<{ data: StripeInvoice[] }>(`/invoices/search?query=${encodeURIComponent(query)}&limit=2`);
  if (result.data.length > 1) throw new Error("Multiple Stripe invoices reference this request. Resolve them in Stripe before continuing.");
  const invoice = result.data[0] ?? null;
  if (invoice?.livemode) throw new Error("Unexpected live Stripe invoice.");
  return invoice;
}

export function assertInvoiceMatchesRequest(invoice: StripeInvoice, input: {
  source: "bank" | "ticket"; requestId: string; amountMinor: number; currency: string;
  checkoutSessionId?: string | null; paymentIntentId?: string | null;
}) {
  if (invoice.livemode || invoice.metadata?.["kind"] !== "cometx_manual_invoice"
    || invoice.metadata?.["cometx_source"] !== input.source
    || invoice.metadata?.["cometx_request_id"] !== input.requestId
    || (input.source === "ticket" && (invoice.metadata?.["original_checkout_session_id"] !== input.checkoutSessionId
      || invoice.metadata?.["original_payment_intent_id"] !== input.paymentIntentId))
    || invoice.total !== input.amountMinor || invoice.currency.toLowerCase() !== input.currency.toLowerCase()) {
    throw new Error("The Stripe invoice does not match this CometX request and amount.");
  }
}

export async function createStripeInvoice(input: {
  requestKey: string; customerId: string; amountMinor: number; currency: string; description: string;
  metadata: Record<string, string>; vatUid?: string | null; existingDraftId?: string | null;
}): Promise<StripeInvoice> {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error("Invoice amount must be positive minor units.");
  const draft = input.existingDraftId ? await retrieveStripeInvoice(input.existingDraftId) : await stripeRequest<StripeInvoice>("/invoices", {
    customer: input.customerId, collection_method: "send_invoice", auto_advance: false,
    pending_invoice_items_behavior: "exclude",
    metadata: { ...input.metadata, kind: "cometx_manual_invoice" },
    ...(input.vatUid ? { custom_fields: [{ name: "VAT / UID", value: input.vatUid.slice(0, 140) }] } : {}),
  }, `cometx-invoice-${input.requestKey}`);
  if (draft.livemode || draft.customer !== input.customerId) throw new Error("Stripe invoice customer mismatch.");
  if (draft.status === "draft") {
    const lines = await stripeRequest<{ data: Array<{ amount: number; currency: string; metadata: Record<string, string> }> }>(
      `/invoices/${encodeURIComponent(draft.id)}/lines?limit=100`,
    );
    const matching = lines.data.filter((line) => line.metadata?.["cometx_invoice_line"] === input.requestKey);
    if (matching.length > 1 || (matching[0] && (matching[0].amount !== input.amountMinor || matching[0].currency.toLowerCase() !== input.currency.toLowerCase()))) {
      throw new Error("The Stripe invoice has conflicting line items; review its draft in Stripe.");
    }
    if (!matching.length) await stripeRequest("/invoiceitems", {
      customer: input.customerId, invoice: draft.id, amount: input.amountMinor,
      currency: input.currency.toLowerCase(), description: input.description,
      metadata: { cometx_invoice_line: input.requestKey },
    }, `cometx-invoice-line-${input.requestKey}`);
    const pricedDraft = await retrieveStripeInvoice(draft.id);
    if (pricedDraft.total !== input.amountMinor || pricedDraft.currency.toLowerCase() !== input.currency.toLowerCase()) {
      throw new Error("Stripe invoice total does not match the saved CometX amount; review the draft in Stripe.");
    }
    const finalized = await stripeRequest<StripeInvoice>(`/invoices/${encodeURIComponent(draft.id)}/finalize`, { auto_advance: false }, `cometx-invoice-finalize-${input.requestKey}`);
    if (finalized.livemode) throw new Error("Unexpected live Stripe invoice.");
    if (finalized.total !== input.amountMinor || finalized.amount_due !== input.amountMinor || finalized.currency.toLowerCase() !== input.currency.toLowerCase()) {
      throw new Error("Finalized Stripe invoice amount differs from the CometX record; review it in Stripe.");
    }
    return finalized;
  }
  if (draft.total !== input.amountMinor || draft.currency.toLowerCase() !== input.currency.toLowerCase()) {
    throw new Error("The existing Stripe invoice amount differs from the CometX record.");
  }
  return draft;
}

export async function markStripeInvoicePaidOutside(id: string, requestKey: string): Promise<StripeInvoice> {
  const current = await retrieveStripeInvoice(id);
  if (current.status === "paid") {
    if (!current.paid_out_of_band) throw new Error("This invoice was paid through Stripe; it cannot be marked paid outside Stripe.");
    return current;
  }
  if (current.status !== "open") throw new Error("Only an open Stripe invoice can be marked paid outside Stripe.");
  const paid = await stripeRequest<StripeInvoice>(`/invoices/${encodeURIComponent(id)}/pay`, { paid_out_of_band: true }, `cometx-outside-paid-${requestKey}`);
  if (paid.status !== "paid" || !paid.paid_out_of_band || paid.livemode) throw new Error("Stripe did not confirm the outside payment.");
  return paid;
}

export async function sendStripeInvoice(id: string, requestKey: string): Promise<StripeInvoice> {
  const current = await retrieveStripeInvoice(id);
  if (current.status !== "paid") throw new Error("Confirm the existing payment before emailing this invoice.");
  return stripeRequest<StripeInvoice>(`/invoices/${encodeURIComponent(id)}/send`, {}, `cometx-invoice-send-${requestKey}`);
}

export async function verifyPaidCheckoutSession(batch: {
  sessionId: string; paymentIntentId: string; amountMinor: number; currency: string;
}): Promise<void> {
  const session = await stripeRequest<{
    livemode: boolean; payment_status: string; payment_intent: string; amount_total: number; currency: string;
  }>(`/checkout/sessions/${encodeURIComponent(batch.sessionId)}`);
  if (session.livemode || session.payment_status !== "paid" || session.payment_intent !== batch.paymentIntentId
    || session.amount_total !== batch.amountMinor || session.currency?.toLowerCase() !== batch.currency.toLowerCase()) {
    throw new Error("The original Stripe Checkout payment could not be verified. Invoice status was not changed.");
  }
}
