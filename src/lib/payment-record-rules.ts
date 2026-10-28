import { z } from "zod";

export const optionalPaymentText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || null);

export const invoiceBillingSchema = z.object({
  name: z.string().trim().min(1).max(240),
  address: z.string().trim().min(1).max(1000),
  vatUid: optionalPaymentText(80),
  note: optionalPaymentText(1000),
});

export const bankTransferInputSchema = z.object({
  partnerId: z.string().uuid(),
  amountMinor: z.number().int().positive().max(1_000_000_000_000),
  currency: z.string().trim().regex(/^[A-Z]{3}$/),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Enter a valid date."),
  reference: z.string().trim().min(1).max(240),
  eventOrderReference: optionalPaymentText(240),
  externalInvoiceId: optionalPaymentText(240),
  note: optionalPaymentText(1000),
  financeVerified: z.literal(true),
  invoice: invoiceBillingSchema.optional(),
});

export const invoiceReferenceInputSchema = z.object({
  source: z.enum(["bank", "ticket"]),
  id: z.string().uuid(),
  invoiceStatus: z.enum(["requested", "issued"]),
  stripeInvoiceId: z.string().trim().regex(/^in_[A-Za-z0-9]+$/).optional().or(z.literal("")),
  externalInvoiceId: optionalPaymentText(240),
  invoiceUrl: z.string().trim().url().max(2000).refine((value) => new URL(value).protocol === "https:", "Enter an HTTPS invoice URL.").optional().or(z.literal("")),
}).superRefine((value, context) => {
  if (value.invoiceStatus === "issued" && !value.stripeInvoiceId && !value.externalInvoiceId && !value.invoiceUrl) {
    context.addIssue({ code: "custom", path: ["invoiceStatus"], message: "An issued invoice needs an ID or document URL." });
  }
});

export function currencyDecimalPlaces(currency: string): number {
  return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

/** Parse a displayed major-unit amount without floating-point rounding. */
export function amountToMinorUnits(value: string, currency: string): number | null {
  let digits: number;
  try { digits = currencyDecimalPlaces(currency); }
  catch { return null; }
  const pattern = digits === 0 ? /^\d+$/ : new RegExp(`^\\d+(?:\\.\\d{1,${digits}})?$`);
  const trimmed = value.trim();
  if (!pattern.test(trimmed)) return null;
  const [whole = "", fractional = ""] = trimmed.split(".");
  const minor = BigInt(whole) * 10n ** BigInt(digits) + BigInt(fractional.padEnd(digits, "0") || "0");
  return minor > 0n && minor <= 1_000_000_000_000n ? Number(minor) : null;
}
