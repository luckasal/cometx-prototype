import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { hasStaffPermission } from "./staff-permissions";
import { bankTransferInputSchema, invoiceBillingSchema, invoiceReferenceInputSchema } from "./payment-record-rules";

const voidInput = z.object({ id: z.string().uuid(), reason: z.string().trim().min(1).max(500) });
const bankInvoiceInput = z.object({ id: z.string().uuid(), billing: invoiceBillingSchema });

export const adminListManualPaymentsAndInvoices = createServerFn({ method: "GET" }).handler(async () => {
  const { requireStaffPermission } = await import("./auth.server");
  const actor = await requireStaffPermission("payments.read");
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const [banks, requests, partners] = await Promise.all([
    db.from("manual_bank_payments").select("*").order("created_at", { ascending: false }).limit(300),
    db.from("ticket_invoice_requests").select("*").order("created_at", { ascending: false }).limit(300),
    db.from("partners").select("id,name,active").order("name"),
  ]);
  if (banks.error || requests.error || partners.error) throw new Error("Payment records could not be loaded. Please try again.");
  const batchIds = (requests.data ?? []).map((request) => request.checkout_batch_id);
  const batchDb = db as unknown as SupabaseClient;
  const batches = batchIds.length
    ? await batchDb.from("ticket_checkout_batches").select("id,buyer_name,buyer_email,status").in("id", batchIds)
    : { data: [], error: null };
  if (batches.error) throw new Error("Invoice buyers could not be loaded. Please try again.");
  const recorderIds = [...new Set((banks.data ?? []).flatMap((bank) => [bank.recorded_by, bank.voided_by].filter((id): id is string => !!id)))];
  const recorders = recorderIds.length
    ? await db.from("profiles").select("id,first_name,last_name,email").in("id", recorderIds)
    : { data: [], error: null };
  if (recorders.error) throw new Error("Payment recorder details could not be loaded. Please try again.");
  const canManageInvoices = hasStaffPermission(actor.staffRoles, "payments.manage_invoices");
  // Payment readers can see operational status, while billing PII and private
  // document links stay limited to staff who manage invoice requests.
  const bankRows = banks.data ?? [];
  const ticketRows = requests.data ?? [];
  return { banks: canManageInvoices ? bankRows : bankRows.map((bank) => ({ ...bank,
      billing_name: null, billing_address: null, vat_uid: null, invoice_note: null,
      stripe_invoice_id: null, external_invoice_id: null, invoice_url: null })),
    requests: canManageInvoices ? ticketRows : ticketRows.map((request) => ({ ...request,
      billing_name: "", billing_address: "", vat_uid: null, note: null,
      stripe_invoice_id: null, external_invoice_id: null, invoice_url: null })),
    partners: partners.data ?? [],
    batches: (batches.data ?? []) as { id: string; buyer_name: string; buyer_email: string; status: string }[],
    recorders: recorders.data ?? [],
    canRecordManual: hasStaffPermission(actor.staffRoles, "payments.record_manual"),
    canManageInvoices };
});

export const adminRecordBankTransfer = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => bankTransferInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireStaffPermission } = await import("./auth.server");
    const actor = await requireStaffPermission("payments.record_manual");
    const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Zurich" }).format(new Date());
    if (data.paidOn > today) throw new Error("The paid date cannot be in the future.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const partner = await db.from("partners").select("id").eq("id", data.partnerId).maybeSingle();
    if (partner.error || !partner.data) throw new Error("Choose an existing partner.");
    const saved = await db.from("manual_bank_payments").insert({
      partner_id: data.partnerId,
      amount_minor: data.amountMinor,
      currency: data.currency,
      paid_on: data.paidOn,
      reference: data.reference,
      event_order_reference: data.eventOrderReference,
      note: data.note,
      recorded_by: actor.userId,
      invoice_requested: !!data.invoice || !!data.externalInvoiceId,
      invoice_requested_by: data.invoice || data.externalInvoiceId ? actor.userId : null,
      invoice_requested_at: data.invoice || data.externalInvoiceId ? new Date().toISOString() : null,
      billing_name: data.invoice?.name ?? null,
      billing_address: data.invoice?.address ?? null,
      vat_uid: data.invoice?.vatUid ?? null,
      invoice_note: data.invoice?.note ?? null,
      invoice_status: data.externalInvoiceId ? "issued" : data.invoice ? "requested" : "none",
      external_invoice_id: data.externalInvoiceId,
      invoice_issued_by: data.externalInvoiceId ? actor.userId : null,
      invoice_issued_at: data.externalInvoiceId ? new Date().toISOString() : null,
    }).select("id").single();
    if (saved.error || !saved.data) throw new Error("Bank transfer could not be recorded. Please try again.");
    return { id: saved.data.id };
  });

export const adminRequestBankInvoice = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => bankInvoiceInput.parse(data))
  .handler(async ({ data }) => {
    const { requireStaffPermission } = await import("./auth.server");
    const actor = await requireStaffPermission("payments.manage_invoices");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const saved = await db.from("manual_bank_payments").update({
      invoice_requested: true, invoice_status: "requested", invoice_requested_by: actor.userId,
      invoice_requested_at: new Date().toISOString(), billing_name: data.billing.name,
      billing_address: data.billing.address, vat_uid: data.billing.vatUid, invoice_note: data.billing.note,
    }).eq("id", data.id).eq("status", "paid").eq("invoice_status", "none").select("id").maybeSingle();
    if (saved.error || !saved.data) throw new Error("Invoice request could not be added to this bank record.");
    return { id: saved.data.id };
  });

export const adminVoidBankTransfer = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => voidInput.parse(data))
  .handler(async ({ data }) => {
    const { requireStaffPermission } = await import("./auth.server");
    const actor = await requireStaffPermission("payments.record_manual");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const updated = await db.from("manual_bank_payments").update({
      status: "void", voided_by: actor.userId, voided_at: new Date().toISOString(), void_reason: data.reason,
    }).eq("id", data.id).eq("status", "paid").neq("invoice_status", "issued").select("id").maybeSingle();
    if (updated.error || !updated.data) throw new Error("This bank record could not be voided. An issued invoice must be handled by finance first.");
    return { id: updated.data.id };
  });

export const adminSaveInvoiceReference = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => invoiceReferenceInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireStaffPermission } = await import("./auth.server");
    const actor = await requireStaffPermission("payments.manage_invoices");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const reference = {
      stripe_invoice_id: data.stripeInvoiceId || null,
      external_invoice_id: data.externalInvoiceId,
      invoice_url: data.invoiceUrl || null,
      invoice_updated_by: actor.userId,
      invoice_updated_at: now,
    };
    if (data.source === "bank") {
      const existing = await db.from("manual_bank_payments").select("invoice_status,status,invoice_issued_by,invoice_issued_at").eq("id", data.id).maybeSingle();
      if (existing.error || !existing.data || existing.data.status !== "paid" || existing.data.invoice_status === "none") {
        throw new Error("This bank transfer has no active invoice request.");
      }
      if (existing.data.invoice_status === "issued" && data.invoiceStatus !== "issued") throw new Error("An issued invoice cannot be returned to requested.");
      const saved = await db.from("manual_bank_payments").update({ ...reference, invoice_status: data.invoiceStatus,
        invoice_issued_by: data.invoiceStatus === "issued" ? existing.data.invoice_issued_by ?? actor.userId : null,
        invoice_issued_at: data.invoiceStatus === "issued" ? existing.data.invoice_issued_at ?? now : null,
      }).eq("id", data.id).eq("status", "paid").neq("invoice_status", "none").select("id").maybeSingle();
      if (saved.error || !saved.data) throw new Error("Bank invoice reference could not be saved.");
      return { id: saved.data.id };
    }
    if (data.source === "ticket") {
      const request = await db.from("ticket_invoice_requests").select("checkout_batch_id,invoice_status,issued_by,issued_at").eq("id", data.id).maybeSingle();
      if (request.error || !request.data) throw new Error("Invoice request not found.");
      if (request.data.invoice_status === "issued" && data.invoiceStatus !== "issued") throw new Error("An issued invoice cannot be returned to requested.");
      const batch = await (db as unknown as SupabaseClient).from("ticket_checkout_batches").select("status").eq("id", request.data.checkout_batch_id).maybeSingle();
      if (batch.error || !batch.data || (data.invoiceStatus === "issued" && !["confirmed", "free"].includes(batch.data.status))) {
        throw new Error("Only a confirmed ticket purchase can be marked invoiced.");
      }
      const saved = await db.from("ticket_invoice_requests").update({ ...reference, invoice_status: data.invoiceStatus,
        issued_by: data.invoiceStatus === "issued" ? request.data.issued_by ?? actor.userId : null,
        issued_at: data.invoiceStatus === "issued" ? request.data.issued_at ?? now : null,
      }).eq("id", data.id).select("id").maybeSingle();
      if (saved.error || !saved.data) throw new Error("Ticket invoice reference could not be saved.");
      return { id: saved.data.id };
    }
    throw new Error("Unsupported invoice source.");
  });
