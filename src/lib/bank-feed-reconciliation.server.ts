import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isQRReferenceValid, isSCORReferenceValid } from "swissqrbill/utils";
import { markStripeInvoicePaidOutside, type StripeInvoice } from "./stripe-invoicing.server";
import { stripeRequest } from "./stripe.server";

export type NormalizedBankTransaction = {
  transactionId: string;
  bookingDate: string;
  amountMinor: number;
  currency: string;
  reference: string;
};

type BankFeedBatch = { provider: string; providerAccountId: string; transactions: NormalizedBankTransaction[] };
type StoredTransaction = { id: string; amount_minor: number; currency: string; payment_reference: string; status: string; stripe_invoice_id: string | null };

function normalizedReference(reference: string) {
  return reference.replace(/\s+/g, "").toUpperCase();
}

function update(db: SupabaseClient, id: string, patch: Record<string, unknown>) {
  return db.from("bank_feed_transactions").update(patch).eq("id", id);
}

async function searchStripeInvoice(reference: string): Promise<StripeInvoice[]> {
  const query = `metadata['cometx_qr_reference']:'${reference}'`;
  const result = await stripeRequest<{ data: StripeInvoice[] }>(`/invoices/search?query=${encodeURIComponent(query)}&limit=3`);
  return result.data;
}

function idempotencyKey(provider: string, accountId: string, transactionId: string) {
  return `cometx-bank-feed-${createHash("sha256").update(`${provider}:${accountId}:${transactionId}`).digest("hex").slice(0, 48)}`;
}

async function persistStatus(db: SupabaseClient, transaction: StoredTransaction, status: string, details: { invoiceId?: string | null; reason?: string | null } = {}) {
  const saved = await update(db, transaction.id, {
    status, stripe_invoice_id: details.invoiceId ?? null,
    failure_reason: details.reason ?? null,
    processed_at: status === "reconciled" ? new Date().toISOString() : null,
  });
  if (saved.error) throw saved.error;
}

async function reconcileOne(db: SupabaseClient, provider: string, providerAccountId: string, tx: NormalizedBankTransaction) {
  const row = {
    provider,
    provider_account_id: providerAccountId,
    provider_transaction_id: tx.transactionId,
    booking_date: tx.bookingDate,
    amount_minor: tx.amountMinor,
    currency: tx.currency.toUpperCase(),
    payment_reference: normalizedReference(tx.reference),
  };
  let found = await db.from("bank_feed_transactions").select("id,amount_minor,currency,payment_reference,status,stripe_invoice_id")
    .eq("provider", provider).eq("provider_account_id", providerAccountId).eq("provider_transaction_id", tx.transactionId).maybeSingle();
  if (found.error) throw found.error;
  if (!found.data) {
    const inserted = await db.from("bank_feed_transactions").insert(row).select("id,amount_minor,currency,payment_reference,status,stripe_invoice_id").maybeSingle();
    if (inserted.error && inserted.error.code !== "23505") throw inserted.error;
    found = inserted.error
      ? await db.from("bank_feed_transactions").select("id,amount_minor,currency,payment_reference,status,stripe_invoice_id").eq("provider", provider).eq("provider_account_id", providerAccountId).eq("provider_transaction_id", tx.transactionId).maybeSingle()
      : inserted;
  }
  if (found.error || !found.data) throw found.error ?? new Error("Bank transaction could not be saved.");
  const stored = found.data as StoredTransaction;
  if (stored.status === "reconciled") return { transactionId: tx.transactionId, status: "reconciled" };
  if (stored.amount_minor !== tx.amountMinor || stored.currency.toUpperCase() !== tx.currency.toUpperCase()
    || normalizedReference(stored.payment_reference) !== normalizedReference(tx.reference)) {
    await persistStatus(db, stored, "mismatch", { reason: "A repeated provider transaction ID arrived with different payment details." });
    return { transactionId: tx.transactionId, status: "mismatch" };
  }

  const reference = normalizedReference(tx.reference);
  if (!isQRReferenceValid(reference) && !isSCORReferenceValid(reference)) {
    await persistStatus(db, stored, "mismatch", { reason: "The incoming bank reference is not a valid Swiss QR or SCOR reference." });
    return { transactionId: tx.transactionId, status: "mismatch" };
  }
  const invoices = await searchStripeInvoice(reference);
  if (!invoices.length) {
    await persistStatus(db, stored, "unmatched", { reason: "No Stripe invoice has this QR payment reference yet." });
    return { transactionId: tx.transactionId, status: "unmatched" };
  }
  if (invoices.length !== 1) {
    await persistStatus(db, stored, "ambiguous", { reason: "More than one Stripe invoice has this QR payment reference." });
    return { transactionId: tx.transactionId, status: "ambiguous" };
  }
  const invoice = invoices[0]!;
  if (invoice.livemode || invoice.status !== "open" || invoice.amount_remaining !== tx.amountMinor
    || invoice.currency.toUpperCase() !== tx.currency.toUpperCase()
    || invoice.collection_method !== "send_invoice" || invoice.metadata?.["cometx_qr_bill"] !== "true") {
    await persistStatus(db, stored, "mismatch", { invoiceId: invoice.id, reason: "Invoice status, amount, currency or QR-bill marker did not exactly match; no Stripe state changed." });
    return { transactionId: tx.transactionId, status: "mismatch" };
  }

  await update(db, stored.id, { status: "matched", stripe_invoice_id: invoice.id, failure_reason: null });
  const paid = await markStripeInvoicePaidOutside(invoice.id, idempotencyKey(provider, providerAccountId, tx.transactionId));
  if (paid.status !== "paid" || !paid.paid_out_of_band) throw new Error("Stripe did not confirm the bank-feed payment out of band.");
  await persistStatus(db, stored, "reconciled", { invoiceId: invoice.id });
  return { transactionId: tx.transactionId, status: "reconciled", stripeInvoiceId: invoice.id };
}

export async function reconcileBankFeedBatch(db: SupabaseClient, input: BankFeedBatch) {
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(input.provider)) throw new Error("Bank-feed provider name is invalid.");
  if (!/^[a-z0-9][a-z0-9._:-]{0,159}$/i.test(input.providerAccountId)) throw new Error("Bank-feed account identifier is invalid.");
  const results = [];
  for (const tx of input.transactions) results.push(await reconcileOne(db, input.provider, input.providerAccountId, tx));
  return results;
}
