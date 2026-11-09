import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { assertInvoiceMatchesRequest, createStripeInvoice, findOrCreateInvoiceCustomer, findStripeInvoiceByRequest, markStripeInvoicePaidOutside, resolveInvoiceBillingEmail, retrieveStripeInvoice, sendStripeInvoice, verifyPaidCheckoutSession, type StripeInvoice } from "./stripe-invoicing.server";

const target = z.object({ source: z.enum(["ticket", "bank"]), id: z.string().uuid() });
const createInput = target.extend({ billingEmail: z.string().trim().email().max(254).optional() });
const paidInput = target.extend({
  bankVerified: z.literal(true).optional(), checkoutPaymentVerified: z.literal(true).optional(),
  note: z.string().trim().max(1000).optional(),
});

type InvoiceRecord = {
  id: string; invoice_requested: boolean; invoice_status: string; stripe_invoice_id: string | null;
  stripe_customer_id: string | null; billing_email: string | null; billing_name: string; billing_address: string;
  stripe_invoice_status: string | null; external_invoice_id: string | null; vat_uid: string | null;
  invoice_sent_at: string | null; invoice_issued_by?: string | null; invoice_issued_at?: string | null; issued_by?: string | null; issued_at?: string | null;
  paid_outside_confirmed_by?: string | null; paid_outside_confirmed_at?: string | null; paid_outside_note?: string | null;
  amount_minor?: number; currency?: string; reference?: string;
  checkout_batch_id?: string; partner_id?: string; status?: string;
};
type Batch = { id: string; buyer_email: string; amount_minor: number; currency: string; status: string;
  stripe_checkout_session_id: string | null; stripe_payment_intent_id: string | null };
type Context = { db: SupabaseClient; record: InvoiceRecord; batch: Batch | null; source: "ticket" | "bank" };

function validateLinkedInvoice(ctx: Context, invoice: StripeInvoice) {
  assertInvoiceMatchesRequest(invoice, {
    source: ctx.source, requestId: ctx.record.id,
    amountMinor: ctx.batch?.amount_minor ?? ctx.record.amount_minor!, currency: ctx.batch?.currency ?? ctx.record.currency!,
    checkoutSessionId: ctx.batch?.stripe_checkout_session_id ?? null, paymentIntentId: ctx.batch?.stripe_payment_intent_id ?? null,
  });
}

async function context(source: "ticket" | "bank", id: string): Promise<Context> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as unknown as SupabaseClient;
  const table = source === "bank" ? "manual_bank_payments" : "ticket_invoice_requests";
  const found = await db.from(table).select("*").eq("id", id).maybeSingle();
  if (found.error || !found.data) throw new Error("Invoice request was not found.");
  const record = found.data as InvoiceRecord;
  if (!record.invoice_requested || record.invoice_status === "none") throw new Error("This record has no invoice request.");
  if (source === "bank") {
    if (record.status !== "paid") throw new Error("Only an active bank-transfer record can have an invoice.");
    return { db, record, batch: null, source };
  }
  const batchResult = await db.from("ticket_checkout_batches").select("id,buyer_email,amount_minor,currency,status,stripe_checkout_session_id,stripe_payment_intent_id")
    .eq("id", record.checkout_batch_id).maybeSingle();
  if (batchResult.error || !batchResult.data) throw new Error("The linked checkout could not be found.");
  const batch = batchResult.data as Batch;
  if (batch.status !== "confirmed" || !batch.stripe_checkout_session_id || !batch.stripe_payment_intent_id || batch.amount_minor <= 0) {
    throw new Error("Only a confirmed, paid Stripe Checkout purchase can receive this invoice.");
  }
  return { db, record, batch, source };
}

async function saveInvoice(ctx: Context, invoice: StripeInvoice, customerId: string, email: string, actorId: string) {
  const table = ctx.source === "bank" ? "manual_bank_payments" : "ticket_invoice_requests";
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    stripe_customer_id: customerId, stripe_invoice_id: invoice.id, billing_email: email,
    stripe_invoice_status: invoice.status, invoice_status: "issued",
    invoice_url: invoice.hosted_invoice_url, invoice_pdf_url: invoice.invoice_pdf,
    invoice_updated_by: actorId, invoice_updated_at: now,
    ...(ctx.source === "bank" ? { invoice_issued_by: ctx.record.invoice_issued_by || actorId, invoice_issued_at: ctx.record.invoice_issued_at || now } : { issued_by: ctx.record.issued_by || actorId, issued_at: ctx.record.issued_at || now }),
  };
  const saved = await ctx.db.from(table).update(patch).eq("id", ctx.record.id).select("id").maybeSingle();
  if (saved.error || !saved.data) throw new Error("Stripe invoice exists, but CometX could not save its reference. Retry this action; it uses the same Stripe invoice.");
  return { id: invoice.id, status: invoice.status, url: invoice.hosted_invoice_url, pdfUrl: invoice.invoice_pdf };
}

async function checkCheckoutPaid(batch: Batch) {
  await verifyPaidCheckoutSession({ sessionId: batch.stripe_checkout_session_id!, paymentIntentId: batch.stripe_payment_intent_id!,
    amountMinor: batch.amount_minor, currency: batch.currency });
}

export const adminCreateStripeInvoice = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => createInput.parse(value))
  .handler(async ({ data }) => {
    const { requireStaffPermission } = await import("./auth.server");
    const actor = await requireStaffPermission("payments.manage_invoices");
    const ctx = await context(data.source, data.id);
    const email = resolveInvoiceBillingEmail(data.billingEmail, ctx.record.billing_email, ctx.batch?.buyer_email);
    const requestKey = `${data.source}-${data.id}`;
    if (ctx.record.stripe_invoice_id) {
      const existing = await retrieveStripeInvoice(ctx.record.stripe_invoice_id);
      if (existing.status !== "draft") validateLinkedInvoice(ctx, existing);
      if (data.billingEmail && ctx.record.billing_email && data.billingEmail.toLowerCase() !== ctx.record.billing_email.toLowerCase()) {
        throw new Error("The billing email cannot be changed after the Stripe invoice exists.");
      }
      if (existing.status === "draft") {
        const resumed = await createStripeInvoice({
          requestKey, customerId: existing.customer, amountMinor: ctx.batch?.amount_minor ?? ctx.record.amount_minor!,
          currency: ctx.batch?.currency ?? ctx.record.currency!, existingDraftId: existing.id,
          description: ctx.source === "bank" ? `Partner bank transfer: ${ctx.record.reference}` : `CometX ticket order ${ctx.batch!.id}`,
          metadata: existing.metadata, vatUid: ctx.record.vat_uid,
        });
        validateLinkedInvoice(ctx, resumed);
        return saveInvoice(ctx, resumed, resumed.customer, ctx.record.billing_email || email, actor.userId);
      }
      return saveInvoice(ctx, existing, existing.customer, ctx.record.billing_email || email, actor.userId);
    }
    if (ctx.record.external_invoice_id) throw new Error("An external invoice is already linked. Resolve it before creating a second invoice in Stripe.");
    if (ctx.batch) await checkCheckoutPaid(ctx.batch);
    const recovered = await findStripeInvoiceByRequest(data.source, data.id);
    if (recovered && !ctx.record.billing_email && data.billingEmail) throw new Error("A Stripe invoice already exists for this request. Reconcile its billing email in Stripe before retrying.");
    if (recovered && recovered.status !== "draft") validateLinkedInvoice(ctx, recovered);
    const customer = await findOrCreateInvoiceCustomer({
      email, name: ctx.record.billing_name, address: ctx.record.billing_address,
      existingId: recovered?.customer || ctx.record.stripe_customer_id, requestKey,
    });
    const amountMinor = ctx.batch?.amount_minor ?? ctx.record.amount_minor;
    const currency = ctx.batch?.currency ?? ctx.record.currency;
    if (!amountMinor || !currency) throw new Error("The invoice amount or currency is missing.");
    const invoice = await createStripeInvoice({
      requestKey, customerId: customer.id, amountMinor, currency, existingDraftId: recovered?.id ?? null,
      description: ctx.source === "bank" ? `Partner bank transfer: ${ctx.record.reference}` : `CometX ticket order ${ctx.batch!.id}`,
      vatUid: ctx.record.vat_uid,
      metadata: { cometx_source: ctx.source, cometx_request_id: data.id,
        ...(ctx.batch ? { original_checkout_session_id: ctx.batch.stripe_checkout_session_id!, original_payment_intent_id: ctx.batch.stripe_payment_intent_id! } : {}) },
    });
    validateLinkedInvoice(ctx, invoice);
    return saveInvoice(ctx, invoice, customer.id, email, actor.userId);
  });

export const adminMarkInvoicePaidOutside = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => paidInput.parse(value))
  .handler(async ({ data }) => {
    const { requireStaffPermission } = await import("./auth.server");
    const actor = await requireStaffPermission("payments.manage_invoices");
    const ctx = await context(data.source, data.id);
    if (data.source === "bank" && data.bankVerified !== true) throw new Error("Confirm that finance verified the bank transfer.");
    if (data.source === "ticket" && data.checkoutPaymentVerified !== true) throw new Error("Confirm this invoice matches the paid Checkout order.");
    if (!ctx.record.stripe_invoice_id) throw new Error("Create the Stripe invoice first.");
    if (ctx.batch) await checkCheckoutPaid(ctx.batch);
    validateLinkedInvoice(ctx, await retrieveStripeInvoice(ctx.record.stripe_invoice_id));
    const paid = await markStripeInvoicePaidOutside(ctx.record.stripe_invoice_id, `${data.source}-${data.id}`);
    const table = data.source === "bank" ? "manual_bank_payments" : "ticket_invoice_requests";
    const patch = {
      stripe_invoice_status: paid.status, invoice_url: paid.hosted_invoice_url, invoice_pdf_url: paid.invoice_pdf,
      paid_outside_confirmed_by: ctx.record.paid_outside_confirmed_by || actor.userId,
      paid_outside_confirmed_at: ctx.record.paid_outside_confirmed_at || new Date().toISOString(),
      paid_outside_note: ctx.record.paid_outside_note || data.note?.trim() || null,
    };
    const saved = await ctx.db.from(table).update(patch).eq("id", data.id).select("id").maybeSingle();
    if (saved.error || !saved.data) throw new Error("Stripe marked the invoice paid, but CometX could not save the audit. Retry to reconcile it.");
    return { id: paid.id, status: paid.status };
  });

export const adminSyncStripeInvoice = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => target.parse(value))
  .handler(async ({ data }) => {
    const { requireStaffPermission } = await import("./auth.server");
    const actor = await requireStaffPermission("payments.manage_invoices");
    const ctx = await context(data.source, data.id);
    if (!ctx.record.stripe_invoice_id) throw new Error("Create the Stripe invoice first.");
    const invoice = await retrieveStripeInvoice(ctx.record.stripe_invoice_id);
    validateLinkedInvoice(ctx, invoice);
    return saveInvoice(ctx, invoice, invoice.customer, ctx.record.billing_email || ctx.batch?.buyer_email || "", actor.userId);
  });

export const adminSendStripeInvoice = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => target.parse(value))
  .handler(async ({ data }) => {
    const { requireStaffPermission } = await import("./auth.server");
    const actor = await requireStaffPermission("payments.manage_invoices");
    const ctx = await context(data.source, data.id);
    if (!ctx.record.stripe_invoice_id) throw new Error("Create the Stripe invoice first.");
    if (ctx.record.invoice_sent_at) return { id: ctx.record.stripe_invoice_id, alreadySent: true };
    validateLinkedInvoice(ctx, await retrieveStripeInvoice(ctx.record.stripe_invoice_id));
    const invoice = await sendStripeInvoice(ctx.record.stripe_invoice_id, `${data.source}-${data.id}`);
    const result = await saveInvoice(ctx, invoice, invoice.customer, ctx.record.billing_email || ctx.batch?.buyer_email || "", actor.userId);
    const table = data.source === "bank" ? "manual_bank_payments" : "ticket_invoice_requests";
    const saved = await ctx.db.from(table).update({ invoice_sent_at: new Date().toISOString() }).eq("id", data.id).is("invoice_sent_at", null).select("id").maybeSingle();
    if (saved.error || !saved.data) throw new Error("Stripe sent the invoice, but CometX could not record that send. Check Stripe before retrying.");
    return result;
  });
