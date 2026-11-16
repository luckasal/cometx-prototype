import { createHash } from "node:crypto";
import { PassThrough } from "node:stream";
import PDFDocument from "pdfkit";
import { PDFDocument as PdfLibDocument } from "pdf-lib";
import { SwissQRBill } from "swissqrbill/pdf";
import { calculateQRReferenceChecksum, calculateSCORReferenceChecksum, isIBANValid, isQRIBAN, isQRReferenceValid, isSCORReferenceValid } from "swissqrbill/utils";
import { markStripeInvoiceQrEmailSent, retrieveStripeInvoice, setStripeInvoiceQrReference, type StripeInvoice } from "./stripe-invoicing.server";
import { stripeRequest } from "./stripe.server";

type Creditor = { account: string; name: string; address: string; buildingNumber?: string; zip: string; city: string; country: string };

function qrCreditor(): Creditor {
  const account = process.env["COMETX_QR_CREDITOR_IBAN"]?.replace(/\s/g, "").toUpperCase();
  const buildingNumber = process.env["COMETX_QR_CREDITOR_BUILDING_NUMBER"]?.trim();
  const creditor: Creditor = {
    account: account ?? "",
    name: process.env["COMETX_QR_CREDITOR_NAME"]?.trim() ?? "",
    address: process.env["COMETX_QR_CREDITOR_STREET"]?.trim() ?? "",
    ...(buildingNumber ? { buildingNumber } : {}),
    zip: process.env["COMETX_QR_CREDITOR_POSTAL_CODE"]?.trim() ?? "",
    city: process.env["COMETX_QR_CREDITOR_CITY"]?.trim() ?? "",
    country: process.env["COMETX_QR_CREDITOR_COUNTRY"]?.trim().toUpperCase() || "CH",
  };
  if (!account || !/^(CH|LI)/.test(account) || !isIBANValid(account) || !creditor.name || !creditor.address || !creditor.zip || !creditor.city || creditor.country.length !== 2) {
    throw new Error("Swiss QR-bill setup is incomplete. Configure CometX creditor name, structured address and a valid bank IBAN/QR-IBAN in server environment variables.");
  }
  return creditor;
}

export function createSwissQrReference(sourceKey: string, iban = qrCreditor().account): string {
  const digest = createHash("sha256").update(sourceKey).digest("hex");
  if (isQRIBAN(iban)) {
    const body = BigInt(`0x${digest}`).toString().padStart(26, "0").slice(-26);
    const reference = `${body}${calculateQRReferenceChecksum(body)}`;
    if (!isQRReferenceValid(reference)) throw new Error("Could not build a valid QR-IBAN reference.");
    return reference;
  }
  const body = BigInt(`0x${digest}`).toString().padStart(20, "0").slice(-20);
  const reference = `RF${calculateSCORReferenceChecksum(body)}${body}`;
  if (!isSCORReferenceValid(reference)) throw new Error("Could not build a valid creditor reference.");
  return reference;
}

export function validSwissQrReferenceForAccount(reference: string, iban: string): boolean {
  return isQRIBAN(iban) ? isQRReferenceValid(reference) : isSCORReferenceValid(reference);
}

async function renderQrSlip(invoice: StripeInvoice, reference: string): Promise<Uint8Array> {
  const creditor = qrCreditor();
  const amountRemaining = invoice.amount_remaining;
  if (invoice.status !== "open" || !Number.isSafeInteger(amountRemaining) || amountRemaining <= 0) {
    throw new Error("Only an unpaid, open Stripe invoice can receive a payable QR-bill.");
  }
  const currency = invoice.currency.toUpperCase();
  if (currency !== "CHF" && currency !== "EUR") throw new Error("Swiss QR-bills only support CHF or EUR invoices.");
  if (!validSwissQrReferenceForAccount(reference, creditor.account)) throw new Error("The invoice payment reference does not match the configured IBAN type.");

  const pdf = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: false });
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on("data", (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve, reject) => {
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
    pdf.on("error", reject);
  });
  pdf.pipe(stream);
  pdf.addPage({ size: "A4", margin: 0 });
  new SwissQRBill({
    creditor,
    currency,
    amount: amountRemaining / 100,
    reference,
    message: `CometX invoice ${invoice.number ?? invoice.id}`.slice(0, 140),
  }, { language: "EN", outlines: true }).attachTo(pdf);
  pdf.end();
  return new Uint8Array(await finished);
}

async function fetchStripeInvoicePdf(url: string): Promise<Uint8Array> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== "invoice.stripe.com") throw new Error("Stripe returned an unexpected invoice PDF location.");
  const response = await fetch(parsed, { redirect: "error", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("Could not download the Stripe invoice PDF.");
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength < 100 || buffer.byteLength > 10_000_000) throw new Error("Stripe invoice PDF has an invalid size.");
  return new Uint8Array(buffer);
}

export async function buildStripeInvoiceWithSwissQr(invoice: StripeInvoice, reference: string): Promise<Buffer> {
  if (!invoice.invoice_pdf) throw new Error("Stripe has not generated an invoice PDF yet.");
  const [stripePdf, qrPdf] = await Promise.all([fetchStripeInvoicePdf(invoice.invoice_pdf), renderQrSlip(invoice, reference)]);
  const original = await PdfLibDocument.load(stripePdf, { updateMetadata: false });
  const slip = await PdfLibDocument.load(qrPdf, { updateMetadata: false });
  const [slipPage] = await original.copyPages(slip, [0]);
  original.addPage(slipPage);
  original.setTitle(`CometX ${invoice.number ?? invoice.id} — Swiss QR-bill`);
  return Buffer.from(await original.save());
}

export async function emailStripeInvoiceWithSwissQr(input: { invoice: StripeInvoice; reference: string; recipient: string; idempotencyKey: string }): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["RESEND_FROM_EMAIL"];
  if (!apiKey || !from) throw new Error("Invoice email is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL on the server.");
  const pdf = await buildStripeInvoiceWithSwissQr(input.invoice, input.reference);
  const invoiceNo = input.invoice.number ?? input.invoice.id;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": input.idempotencyKey },
    body: JSON.stringify({
      from, to: [input.recipient], subject: `CometX invoice ${invoiceNo}`,
      text: `Attached is CometX invoice ${invoiceNo} with its Swiss QR-bill payment slip. The amount and payment status remain managed in Stripe.`,
      attachments: [{ filename: `CometX-invoice-${invoiceNo}-QR.pdf`, content: pdf.toString("base64") }],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error("Resend could not send the Swiss QR-bill invoice email.");
}

export function configuredQrIban(): string {
  return qrCreditor().account;
}

export async function sendFinalizedStripeInvoiceWithSwissQr(invoiceId: string): Promise<void> {
  let invoice = await retrieveStripeInvoice(invoiceId);
  if (invoice.status !== "open" || invoice.amount_remaining <= 0 || invoice.collection_method !== "send_invoice") return;
  if (!["CHF", "EUR"].includes(invoice.currency.toUpperCase())) return;
  // Existing Checkout, manual-payment and membership invoices represent settled/managed flows.
  // Only ordinary send-invoice billing receives a payable QR slip.
  if (["cometx_manual_invoice", "cometx_membership", "ticket_checkout", "ticket_checkout_batch", "ticket_order"].includes(invoice.metadata?.["kind"] ?? "")) return;
  if (invoice.metadata?.["cometx_qr_email_sent"] === "true") return;

  const customer = typeof invoice.customer === "string" && !invoice.customer_email
    ? await stripeRequest<{ email: string | null }>(`/customers/${encodeURIComponent(invoice.customer)}`)
    : null;
  const recipient = invoice.customer_email || customer?.email;
  if (!recipient) throw new Error(`Stripe invoice ${invoice.id} needs a billing email before the QR-bill can be sent.`);
  const iban = configuredQrIban();
  const reference = invoice.metadata?.["cometx_qr_reference"] ?? createSwissQrReference(`stripe:${invoice.id}`, iban);
  if (!validSwissQrReferenceForAccount(reference, iban)) throw new Error(`Stripe invoice ${invoice.id} has a QR reference that does not match the configured IBAN.`);
  invoice = await setStripeInvoiceQrReference(invoice, reference);
  await emailStripeInvoiceWithSwissQr({
    invoice, reference, recipient,
    idempotencyKey: `cometx-stripe-qr-invoice-${invoice.id}`,
  });
  await markStripeInvoiceQrEmailSent(invoice);
}
