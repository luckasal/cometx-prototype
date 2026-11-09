import { z } from "zod";

// Stripe includes explicit nulls for unavailable Checkout Session fields (notably url
// after completion). Reject malformed events without rejecting valid Stripe payloads.
export const stripeWebhookEventSchema = z.object({
  type: z.string(),
  data: z.object({ object: z.object({
    id: z.string().min(1),
    type: z.string().optional(),
    url: z.string().nullable().optional(),
    amount_total: z.number().int().nullable().optional(),
    currency: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.string()).nullable().optional(),
    payment_status: z.string().optional(),
    livemode: z.boolean().optional(),
  }).passthrough() }),
});

export function isCometxManualInvoiceEvent(event: { type: string; data: { object: { id: string; metadata?: Record<string, string> | null | undefined } } }): boolean {
  const invoice = event.data.object;
  return ["invoice.finalized", "invoice.sent", "invoice.paid", "invoice.voided", "invoice.marked_uncollectible"].includes(event.type)
    && invoice.id.startsWith("in_") && invoice.metadata?.["kind"] === "cometx_manual_invoice"
    && ["bank", "ticket"].includes(invoice.metadata?.["cometx_source"] ?? "")
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoice.metadata?.["cometx_request_id"] ?? "");
}
