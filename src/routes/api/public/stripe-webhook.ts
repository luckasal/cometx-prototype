import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isPaidCheckout } from "@/lib/checkout";

const eventSchema = z.object({
  type: z.string(),
  data: z.object({ object: z.object({
    id: z.string().min(1),
    type: z.string().optional(),
    url: z.string().optional(),
    amount_total: z.number().int().optional(),
    currency: z.string().optional(),
    metadata: z.record(z.string(),z.string()).optional(),
    payment_status: z.string().optional(),
    livemode: z.boolean().optional(),
  }).passthrough() }),
});

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: { handlers: {
    POST: async ({ request }) => {
      const { verifyStripeSignature } = await import("@/lib/stripe.server");
      let event;
      try {
        event = eventSchema.parse(await verifyStripeSignature(await request.text(), request.headers.get("stripe-signature")));
      } catch {
        return new Response("Invalid webhook", { status: 400 });
      }
      if (["checkout.session.completed", "checkout.session.async_payment_succeeded","checkout.session.expired","checkout.session.async_payment_failed"].includes(event.type)) {
        try {
          if (event.data.object.metadata?.["kind"] === "ticket_checkout") {
            const { applyTicketPaymentEvent } = await import("@/lib/ticket-payments.server");
            await applyTicketPaymentEvent(event.type,event.data.object);
          } else if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)
            && isPaidCheckout(event.data.object)) {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { error } = await supabaseAdmin.rpc("fulfill_cometx_checkout",{p_session:JSON.parse(JSON.stringify(event.data.object))});
            if (error) throw error;
          }
        } catch (error) {
          console.error("[stripe-webhook] fulfillment failed", error);
          // Non-2xx allows Stripe to retry; never acknowledge a failed database write.
          return new Response("Fulfillment failed", { status: 500 });
        }
      }
      return Response.json({ received: true });
    },
  } },
});
