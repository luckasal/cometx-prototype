import { stripeRequest } from "./stripe.server.ts";
import { assertInvoiceMatchesRequest, type StripeInvoice } from "./stripe-invoicing.server.ts";

export async function syncCometxInvoiceEvent(db: {
  from: (table: string) => any;
}, invoiceId: string, source: "bank" | "ticket", requestId: string): Promise<void> {
  const table = source === "bank" ? "manual_bank_payments" : "ticket_invoice_requests";
  const existing = await db.from(table).select("id,amount_minor,currency,checkout_batch_id,stripe_invoice_id")
    .eq("id", requestId).eq("stripe_invoice_id", invoiceId).maybeSingle();
  if (existing.error) throw existing.error;
  if (!existing.data) return; // An invoice can finalize before the link is saved; the admin action then reconciles it.
  let amountMinor = existing.data.amount_minor as number;
  let currency = existing.data.currency as string;
  let checkoutSessionId: string | null = null;
  let paymentIntentId: string | null = null;
  if (source === "ticket") {
    const batch = await db.from("ticket_checkout_batches")
      .select("amount_minor,currency,stripe_checkout_session_id,stripe_payment_intent_id")
      .eq("id", existing.data.checkout_batch_id).maybeSingle();
    if (batch.error || !batch.data) throw new Error("The invoice checkout batch is missing.");
    amountMinor = batch.data.amount_minor;
    currency = batch.data.currency;
    checkoutSessionId = batch.data.stripe_checkout_session_id;
    paymentIntentId = batch.data.stripe_payment_intent_id;
  }
  const invoice = await stripeRequest<StripeInvoice>(`/invoices/${encodeURIComponent(invoiceId)}`);
  assertInvoiceMatchesRequest(invoice, { source, requestId, amountMinor, currency, checkoutSessionId, paymentIntentId });
  const updated = await db.from(table).update({
    stripe_invoice_status: invoice.status,
    invoice_url: invoice.hosted_invoice_url,
    invoice_pdf_url: invoice.invoice_pdf,
  }).eq("id", requestId).eq("stripe_invoice_id", invoiceId);
  if (updated.error) throw updated.error;
}
