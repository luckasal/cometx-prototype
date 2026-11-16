import { createHmac, timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const payloadSchema = z.object({
  provider: z.string().trim().min(1).max(80),
  providerAccountId: z.string().trim().min(1).max(160),
  transactions: z.array(z.object({
    transactionId: z.string().trim().min(1).max(200),
    bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((date) => {
      const parsed = new Date(`${date}T00:00:00Z`);
      return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date;
    }),
    amountMinor: z.number().int().positive().safe(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    reference: z.string().trim().min(1).max(140),
  }).strict()).min(1).max(200),
}).strict();

function hasValidSignature(body: string, header: string | null, secret: string): boolean {
  const supplied = header?.replace(/^sha256=/i, "").trim() ?? "";
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const expected = createHmac("sha256", secret).update(body, "utf8").digest();
  const actual = Buffer.from(supplied, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export const Route = createFileRoute("/api/public/bank-feed")({
  server: { handlers: {
    POST: async ({ request }) => {
      const secret = process.env["BANK_FEED_WEBHOOK_SECRET"];
      const expectedProvider = process.env["BANK_FEED_PROVIDER"];
      const expectedAccount = process.env["BANK_FEED_ACCOUNT_ID"];
      if (!secret || secret.length < 32 || !expectedProvider || !expectedAccount) return new Response("Bank feed is not configured", { status: 503 });
      const body = await request.text();
      if (body.length > 256_000) return new Response("Payload too large", { status: 413 });
      if (!hasValidSignature(body, request.headers.get("x-cometx-bank-feed-signature"), secret)) return new Response("Unauthorized", { status: 401 });
      let payload: z.infer<typeof payloadSchema>;
      try { payload = payloadSchema.parse(JSON.parse(body)); }
      catch { return new Response("Invalid bank-feed payload", { status: 400 }); }
      if (payload.provider.toLowerCase() !== expectedProvider.trim().toLowerCase()) return new Response("Unexpected bank-feed provider", { status: 403 });
      if (payload.providerAccountId !== expectedAccount.trim()) return new Response("Unexpected bank-feed account", { status: 403 });

      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { reconcileBankFeedBatch } = await import("@/lib/bank-feed-reconciliation.server");
        const results = await reconcileBankFeedBatch(supabaseAdmin as never, payload);
        return Response.json({ received: results.length, results });
      } catch (error) {
        console.error("[bank-feed] reconciliation failed", error instanceof Error ? error.message : "Unknown error");
        return new Response("Bank-feed reconciliation failed", { status: 500 });
      }
    },
  } },
});
