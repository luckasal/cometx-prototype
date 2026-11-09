import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminListManualPaymentsAndInvoices, adminRecordBankTransfer, adminRequestBankInvoice, adminSaveInvoiceReference, adminVoidBankTransfer } from "@/lib/payment-admin.functions";
import { adminCreateStripeInvoice, adminMarkInvoicePaidOutside, adminSendStripeInvoice, adminSyncStripeInvoice } from "@/lib/invoice-admin.functions";
import { amountToMinorUnits, currencyDecimalPlaces } from "@/lib/payment-record-rules";
import { AdminTable, inputClass, textareaClass } from "./AdminBits";
import { Button } from "@/components/ui/button";
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from "@/components/site/Bits";
import { formatMoney } from "@/lib/pricing";

export function PaymentManagement() {
  const cache = useQueryClient();
  const fetchRecords = useServerFn(adminListManualPaymentsAndInvoices);
  const recordBank = useServerFn(adminRecordBankTransfer);
  const requestBankInvoice = useServerFn(adminRequestBankInvoice);
  const voidBank = useServerFn(adminVoidBankTransfer);
  const saveInvoiceReference = useServerFn(adminSaveInvoiceReference);
  const createStripeInvoice = useServerFn(adminCreateStripeInvoice);
  const markPaidOutside = useServerFn(adminMarkInvoicePaidOutside);
  const sendInvoice = useServerFn(adminSendStripeInvoice);
  const syncInvoice = useServerFn(adminSyncStripeInvoice);
  const records = useQuery({ queryKey: ["admin", "manual-payments-invoices"], queryFn: () => fetchRecords() });
  const [partnerId, setPartnerId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("CHF");
  const [paidOn, setPaidOn] = useState("");
  const [reference, setReference] = useState("");
  const [eventOrderReference, setEventOrderReference] = useState("");
  const [externalExistingInvoiceId, setExternalExistingInvoiceId] = useState("");
  const [note, setNote] = useState("");
  const [financeVerified, setFinanceVerified] = useState(false);
  const [invoiceRequested, setInvoiceRequested] = useState(false);
  const [billingName, setBillingName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [vatUid, setVatUid] = useState("");
  const [invoiceNote, setInvoiceNote] = useState("");
  const [invoiceTarget, setInvoiceTarget] = useState<{ source: "bank" | "ticket"; id: string } | null>(null);
  const [requestBankId, setRequestBankId] = useState<string | null>(null);
  const [externalInvoiceId, setExternalInvoiceId] = useState("");
  const [invoiceUrl, setInvoiceUrl] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState<"requested" | "issued">("requested");
  const amountMinor = amountToMinorUnits(amount, currency) ?? 0;
  const refresh = () => cache.invalidateQueries({ queryKey: ["admin", "manual-payments-invoices"] });
  type StripeAction = { kind: "create" | "paid" | "send" | "sync"; source: "bank" | "ticket"; id: string; email?: string };
  const stripeAction = useMutation({
    mutationFn: async (action: StripeAction) => {
      if (action.kind === "create") return createStripeInvoice({ data: { source: action.source, id: action.id, billingEmail: action.email } });
      if (action.kind === "paid") return markPaidOutside({ data: { source: action.source, id: action.id,
        ...(action.source === "bank" ? { bankVerified: true as const } : { checkoutPaymentVerified: true as const }) } });
      if (action.kind === "send") return sendInvoice({ data: { source: action.source, id: action.id } });
      return syncInvoice({ data: { source: action.source, id: action.id } });
    },
    onSuccess: (_result, action) => { toast.success(action.kind === "create" ? "Stripe invoice created" : action.kind === "paid" ? "Stripe invoice marked paid outside Stripe" : action.kind === "send" ? "Stripe invoice sent" : "Stripe status refreshed"); refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });
  function startStripeInvoice(source: "bank" | "ticket", id: string, email: string | null) {
    const entered = email || window.prompt("Billing email required for the Stripe invoice:")?.trim();
    if (!entered) return;
    stripeAction.mutate({ kind: "create", source, id, email: entered });
  }
  function confirmOutside(source: "bank" | "ticket", id: string) {
    const message = source === "bank"
      ? "Finance verified this transfer in the real bank/accounting system. Mark the Stripe invoice paid outside Stripe? No Stripe charge will occur."
      : "This invoice matches the existing paid Stripe Checkout order. Mark only the invoice paid outside Stripe? No new charge or ticket fulfillment will occur.";
    if (window.confirm(message)) stripeAction.mutate({ kind: "paid", source, id });
  }
  const record = useMutation({
    mutationFn: () => recordBank({ data: { partnerId, amountMinor, currency: currency.trim().toUpperCase(), paidOn, reference,
      eventOrderReference, externalInvoiceId: externalExistingInvoiceId, note,
      financeVerified: true, ...(invoiceRequested ? { invoice: { name: billingName, email: billingEmail, address: billingAddress, vatUid, note: invoiceNote } } : {}) } }),
    onSuccess: () => { toast.success("Bank transfer recorded"); setAmount(""); setPaidOn(""); setReference(""); setEventOrderReference(""); setExternalExistingInvoiceId(""); setNote(""); setFinanceVerified(false);
      setInvoiceRequested(false); setBillingName(""); setBillingEmail(""); setBillingAddress(""); setVatUid(""); setInvoiceNote(""); refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const voidRecord = useMutation({
    mutationFn: (data: { id: string; reason: string }) => voidBank({ data }),
    onSuccess: () => { toast.success("Bank record voided"); refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const requestInvoice = useMutation({
    mutationFn: () => { if (!requestBankId) throw new Error("Choose a bank record."); return requestBankInvoice({ data: { id: requestBankId,
      billing: { name: billingName, email: billingEmail, address: billingAddress, vatUid, note: invoiceNote } } }); },
    onSuccess: () => { toast.success("Invoice request saved"); setRequestBankId(null); setBillingName(""); setBillingEmail(""); setBillingAddress(""); setVatUid(""); setInvoiceNote(""); refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const issue = useMutation({
    mutationFn: () => { if (!invoiceTarget) throw new Error("Choose an invoice request."); return saveInvoiceReference({ data: { ...invoiceTarget, invoiceStatus, stripeInvoiceId: "", externalInvoiceId, invoiceUrl } }); },
    onSuccess: () => { toast.success("Invoice reference saved"); setInvoiceTarget(null); setExternalInvoiceId(""); setInvoiceUrl(""); refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const partnerNames = new Map((records.data?.partners ?? []).map((partner) => [partner.id, partner.name]));
  const batches = new Map((records.data?.batches ?? []).map((batch) => [batch.id, batch]));
  const recorderNames = new Map((records.data?.recorders ?? []).map((person) => [person.id,
    [person.first_name, person.last_name].filter(Boolean).join(" ") || person.email || person.id]));
  function editInvoice(source: "bank" | "ticket", item: { id: string; invoice_status: "none" | "requested" | "issued"; stripe_invoice_id: string | null; external_invoice_id: string | null; invoice_url: string | null }) {
    setInvoiceTarget({ source, id: item.id }); setInvoiceStatus(item.invoice_status === "none" ? "requested" : item.invoice_status);
 setExternalInvoiceId(item.external_invoice_id ?? ""); setInvoiceUrl(item.invoice_url ?? "");
  }

  return <div className="space-y-10">
    {records.isLoading && <LoadingBlock label="Loading bank and invoice records" />}
    {records.error && <ErrorBlock error={records.error} />}
    {records.data?.canRecordManual && <section className="space-y-4"><h2 className="font-display text-xl font-bold">Record a partner bank transfer</h2>
      <p className="text-sm text-muted-foreground">Only record a transfer finance verified in the bank. This does not charge Stripe or fulfill an order.</p>
      <form className="grid gap-4 rounded-2xl border border-border p-5 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); if (financeVerified && amountMinor > 0) record.mutate(); }}>
        <label className="text-sm">Partner<select required className={inputClass} value={partnerId} onChange={(event) => setPartnerId(event.target.value)}><option value="">Choose partner</option>{(records.data?.partners ?? []).filter((partner) => partner.active).map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}</select></label>
        <label className="text-sm">Amount<input required inputMode="decimal" className={inputClass} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="2000.00" /></label>
        <label className="text-sm">Currency<input required maxLength={3} className={inputClass} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} /></label>
        <label className="text-sm">Paid date<input required type="date" max={new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Zurich" }).format(new Date())} className={inputClass} value={paidOn} onChange={(event) => setPaidOn(event.target.value)} /></label>
        <label className="text-sm sm:col-span-2">Bank reference<input required maxLength={240} className={inputClass} value={reference} onChange={(event) => setReference(event.target.value)} /></label>
        <label className="text-sm sm:col-span-2">Event or order reference (optional)<input maxLength={240} className={inputClass} value={eventOrderReference} onChange={(event) => setEventOrderReference(event.target.value)} placeholder="Symposium / order reference" /></label>
        <label className="text-sm sm:col-span-2">Existing external invoice ID (optional)<input maxLength={240} className={inputClass} value={externalExistingInvoiceId} onChange={(event) => setExternalExistingInvoiceId(event.target.value)} placeholder="If an invoice was already issued outside CometX" /></label>
        {externalExistingInvoiceId.trim() && <p className="text-xs text-muted-foreground sm:col-span-2">This existing invoice will be marked issued. The payment remains a bank transfer.</p>}
        <label className="text-sm sm:col-span-2">Internal note (optional)<textarea maxLength={1000} className={textareaClass} value={note} onChange={(event) => setNote(event.target.value)} /></label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={invoiceRequested} onChange={(event) => setInvoiceRequested(event.target.checked)} />Invoice requested</label>
        {invoiceRequested && <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
          <label className="text-sm">Billing name or company<input required maxLength={240} className={inputClass} value={billingName} onChange={(event) => setBillingName(event.target.value)} /></label>
          <label className="text-sm">Billing email<input type="email" maxLength={254} className={inputClass} value={billingEmail} onChange={(event) => setBillingEmail(event.target.value)} placeholder="Required to create a Stripe invoice" /></label>
          <label className="text-sm">VAT / UID (optional)<input maxLength={80} className={inputClass} value={vatUid} onChange={(event) => setVatUid(event.target.value)} /></label>
          <label className="text-sm sm:col-span-2">Billing address<textarea required maxLength={1000} className={textareaClass} value={billingAddress} onChange={(event) => setBillingAddress(event.target.value)} /></label>
          <label className="text-sm sm:col-span-2">Invoice note (optional)<input maxLength={1000} className={inputClass} value={invoiceNote} onChange={(event) => setInvoiceNote(event.target.value)} /></label>
        </div>}
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input required type="checkbox" checked={financeVerified} onChange={(event) => setFinanceVerified(event.target.checked)} />Finance verified this transfer in the bank</label>
        <Button type="submit" variant="ink" disabled={!records.data || !financeVerified || amountMinor <= 0 || record.isPending}>{record.isPending ? "Recording…" : "Record bank transfer"}</Button>
      </form>
    </section>}
    <section className="space-y-4"><h2 className="font-display text-xl font-bold">Bank transfers</h2>
      {records.data?.banks.length === 0 && <EmptyBlock title="No bank transfers recorded" />}
      {!!records.data?.banks.length && <AdminTable head={["Method / partner", "Amount / paid", "Reference", "Status", "Recorded by", "Invoice", "Actions"]}>{records.data.banks.map((bank) => <tr key={bank.id} className="[&>td]:px-4 [&>td]:py-3">
        <td><strong>Bank transfer</strong><span className="block text-xs">{partnerNames.get(bank.partner_id) ?? "Partner unavailable"}</span></td>
        <td>{formatMoney(bank.amount_minor / 10 ** currencyDecimalPlaces(bank.currency), bank.currency)}<span className="block text-xs">{bank.paid_on}</span></td>
        <td>{bank.reference}{bank.event_order_reference && <span className="block text-xs">Event/order: {bank.event_order_reference}</span>}{bank.note && <span className="block text-xs text-muted-foreground">{bank.note}</span>}</td>
        <td><StatusPill tone={bank.status === "paid" ? "success" : "muted"}>{bank.status}</StatusPill>{bank.void_reason && <span className="block text-xs">Voided: {bank.void_reason}<br />{recorderNames.get(bank.voided_by ?? "") ?? bank.voided_by} · {bank.voided_at && new Date(bank.voided_at).toLocaleString("en-GB")}</span>}</td>
        <td>{recorderNames.get(bank.recorded_by) ?? bank.recorded_by}<span className="block text-xs">{new Date(bank.recorded_at).toLocaleString("en-GB")}</span></td>
        <td>{bank.invoice_status}{bank.stripe_invoice_id && <span className="block text-xs">Stripe: {bank.stripe_invoice_status ?? "sync needed"} · {bank.stripe_invoice_id}</span>}{bank.external_invoice_id && <span className="block text-xs">External: {bank.external_invoice_id}</span>}{bank.invoice_url && <a className="block underline" href={bank.invoice_url} target="_blank" rel="noreferrer">Open in Stripe</a>}{bank.invoice_pdf_url && <a className="block underline" href={bank.invoice_pdf_url} target="_blank" rel="noreferrer">Stripe PDF</a>}{bank.invoice_sent_at && <span className="block text-xs">Sent from Stripe {new Date(bank.invoice_sent_at).toLocaleString("en-GB")}</span>}{bank.paid_outside_confirmed_at && <span className="block text-xs">Outside payment confirmed {new Date(bank.paid_outside_confirmed_at).toLocaleString("en-GB")}</span>}{bank.billing_name && <details className="text-xs"><summary className="cursor-pointer">Billing details</summary>{bank.billing_name}<br />{bank.billing_email}<br />{bank.billing_address}<br />{bank.vat_uid}</details>}</td>
        <td className="space-x-2 space-y-2">{records.data?.canManageInvoices && bank.status === "paid" && bank.invoice_status === "none" && <Button type="button" variant="outlineInk" onClick={() => { setRequestBankId(bank.id); setBillingName(""); setBillingEmail(""); setBillingAddress(""); setVatUid(""); setInvoiceNote(""); }}>Request invoice</Button>}{records.data?.canManageInvoices && bank.status === "paid" && bank.invoice_status !== "none" && !bank.stripe_invoice_id && !bank.external_invoice_id && <Button type="button" variant="ink" disabled={stripeAction.isPending} onClick={() => startStripeInvoice("bank", bank.id, bank.billing_email)}>Create Stripe invoice</Button>}{records.data?.canManageInvoices && bank.stripe_invoice_id && <Button type="button" variant="outlineInk" disabled={stripeAction.isPending} onClick={() => stripeAction.mutate({ kind: "sync", source: "bank", id: bank.id })}>Refresh status</Button>}{records.data?.canManageInvoices && bank.stripe_invoice_id && bank.stripe_invoice_status === "open" && <Button type="button" variant="ink" disabled={stripeAction.isPending} onClick={() => confirmOutside("bank", bank.id)}>Mark paid outside Stripe</Button>}{records.data?.canManageInvoices && bank.stripe_invoice_id && bank.stripe_invoice_status === "paid" && !bank.invoice_sent_at && <Button type="button" variant="outlineInk" disabled={stripeAction.isPending} onClick={() => stripeAction.mutate({ kind: "send", source: "bank", id: bank.id })}>Send Stripe invoice</Button>}{records.data?.canManageInvoices && bank.status === "paid" && bank.invoice_status !== "none" && !bank.stripe_invoice_id && <Button type="button" variant="outlineInk" onClick={() => editInvoice("bank", bank)}>External reference</Button>}{records.data?.canRecordManual && bank.status === "paid" && bank.invoice_status !== "issued" && <Button type="button" variant="outlineInk" disabled={voidRecord.isPending} onClick={() => { const reason = window.prompt("Void this bank record? Enter the reason. The history will remain visible."); if (reason?.trim()) voidRecord.mutate({ id: bank.id, reason: reason.trim() }); }}>Void record</Button>}</td>
      </tr>)}</AdminTable>}
    </section>
    {records.data?.canManageInvoices && requestBankId && <form className="space-y-3 rounded-2xl border border-border p-5" onSubmit={(event) => { event.preventDefault(); requestInvoice.mutate(); }}><h2 className="font-display text-xl font-bold">Request invoice for bank transfer</h2><input required maxLength={240} className={inputClass} value={billingName} onChange={(event) => setBillingName(event.target.value)} placeholder="Billing name or company" /><input type="email" maxLength={254} className={inputClass} value={billingEmail} onChange={(event) => setBillingEmail(event.target.value)} placeholder="Billing email for Stripe" /><textarea required maxLength={1000} className={textareaClass} value={billingAddress} onChange={(event) => setBillingAddress(event.target.value)} placeholder="Billing address" /><input maxLength={80} className={inputClass} value={vatUid} onChange={(event) => setVatUid(event.target.value)} placeholder="VAT / UID (optional)" /><input maxLength={1000} className={inputClass} value={invoiceNote} onChange={(event) => setInvoiceNote(event.target.value)} placeholder="Note (optional)" /><div className="flex gap-2"><Button type="submit" variant="ink" disabled={requestInvoice.isPending}>Save request</Button><Button type="button" variant="outlineInk" onClick={() => setRequestBankId(null)}>Cancel</Button></div></form>}
    <section className="space-y-4"><h2 className="font-display text-xl font-bold">Ticket invoice requests</h2>
      {records.data?.requests.length === 0 && <EmptyBlock title="No ticket invoice requests yet" />}
      {!!records.data?.requests.length && <AdminTable head={["Buyer / checkout", "Billing details", "Status", "Invoice", "Action"]}>{records.data.requests.map((request) => {
        const batch = batches.get(request.checkout_batch_id);
        return <tr key={request.id} className="[&>td]:px-4 [&>td]:py-3"><td><strong>{batch?.buyer_name ?? "Buyer unavailable"}</strong><span className="block text-xs">{batch?.buyer_email} · {batch?.status ?? "unknown"}</span></td><td>{request.billing_name}<span className="block whitespace-pre-wrap text-xs">{request.billing_address}</span>{request.vat_uid && <span className="block text-xs">VAT / UID: {request.vat_uid}</span>}{request.note && <span className="block text-xs">{request.note}</span>}</td><td>{request.invoice_status}{request.stripe_invoice_id && <span className="block text-xs">Stripe: {request.stripe_invoice_status ?? "sync needed"}</span>}{request.invoice_sent_at && <span className="block text-xs">Sent from Stripe {new Date(request.invoice_sent_at).toLocaleString("en-GB")}</span>}{request.paid_outside_confirmed_at && <span className="block text-xs">Already paid via Checkout · invoice settled without another charge</span>}</td><td>{request.stripe_invoice_id && <span className="block text-xs">Stripe: {request.stripe_invoice_id}</span>}{request.external_invoice_id && <span className="block text-xs">External: {request.external_invoice_id}</span>}{request.invoice_url && <a href={request.invoice_url} target="_blank" rel="noreferrer" className="underline">Open in Stripe</a>}{request.invoice_pdf_url && <a href={request.invoice_pdf_url} target="_blank" rel="noreferrer" className="block underline">Stripe PDF</a>}</td><td className="space-x-2 space-y-2">{records.data?.canManageInvoices && batch?.status === "confirmed" && !request.stripe_invoice_id && !request.external_invoice_id && <Button type="button" variant="ink" disabled={stripeAction.isPending} onClick={() => startStripeInvoice("ticket", request.id, request.billing_email || batch?.buyer_email || null)}>Already paid via Checkout — create invoice without charging again</Button>}{records.data?.canManageInvoices && request.stripe_invoice_id && <Button type="button" variant="outlineInk" disabled={stripeAction.isPending} onClick={() => stripeAction.mutate({ kind: "sync", source: "ticket", id: request.id })}>Refresh status</Button>}{records.data?.canManageInvoices && request.stripe_invoice_id && request.stripe_invoice_status === "open" && <Button type="button" variant="ink" disabled={stripeAction.isPending} onClick={() => confirmOutside("ticket", request.id)}>Confirm existing Checkout payment</Button>}{records.data?.canManageInvoices && request.stripe_invoice_id && request.stripe_invoice_status === "paid" && !request.invoice_sent_at && <Button type="button" variant="outlineInk" disabled={stripeAction.isPending} onClick={() => stripeAction.mutate({ kind: "send", source: "ticket", id: request.id })}>Send Stripe invoice</Button>}{records.data?.canManageInvoices && !request.stripe_invoice_id && <Button type="button" variant="outlineInk" onClick={() => editInvoice("ticket", request)}>External reference</Button>}</td></tr>;
      })}</AdminTable>}
    </section>
    {records.data?.canManageInvoices && invoiceTarget && <form className="space-y-3 rounded-2xl border border-border p-5" onSubmit={(event) => { event.preventDefault(); issue.mutate(); }}><h2 className="font-display text-xl font-bold">External invoice reference</h2><p className="text-sm text-muted-foreground">Stripe invoices are created through the Stripe action above. Use this only for an existing external invoice.</p><label className="block text-sm">Invoice status<select className={inputClass} value={invoiceStatus} onChange={(event) => setInvoiceStatus(event.target.value as "requested" | "issued")}><option value="requested">Requested</option><option value="issued">Issued</option></select></label><input className={inputClass} value={externalInvoiceId} onChange={(event) => setExternalInvoiceId(event.target.value)} placeholder="External invoice ID (optional)" /><input type="url" className={inputClass} value={invoiceUrl} onChange={(event) => setInvoiceUrl(event.target.value)} placeholder="HTTPS document URL (optional)" /><p className="text-xs text-muted-foreground">Issued requires an external ID or document URL. An issued invoice cannot be returned to requested.</p><div className="flex gap-2"><Button type="submit" variant="ink" disabled={issue.isPending}>Save external reference</Button><Button type="button" variant="outlineInk" onClick={() => setInvoiceTarget(null)}>Cancel</Button></div></form>}
  </div>;
}
