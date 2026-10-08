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
