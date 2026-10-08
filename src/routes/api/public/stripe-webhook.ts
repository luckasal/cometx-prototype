import { createFileRoute } from "@tanstack/react-router";
import { isPaidCheckout } from "@/lib/checkout";
import { stripeWebhookEventSchema } from "@/lib/stripe-webhook-event";

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: { handlers: {
    POST: async ({ request }) => {
      const { verifyStripeSignature } = await import("@/lib/stripe.server");
      let event;
      try {
        event = stripeWebhookEventSchema.parse(await verifyStripeSignature(await request.text(), request.headers.get("stripe-signature")));
      } catch (error) {
        console.error("[stripe-webhook] verification or payload validation failed", error instanceof Error ? error.message : "Unknown error");
        return new Response("Invalid webhook", { status: 400 });
      }
      if (["checkout.session.completed", "checkout.session.async_payment_succeeded","checkout.session.expired","checkout.session.async_payment_failed", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
        try {
          if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)
            && event.data.object.metadata?.["kind"] === "membership_application") {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { error } = await supabaseAdmin.rpc("fulfill_cometx_membership_application", {
              p_session: JSON.parse(JSON.stringify(event.data.object)),
            });
            if (error) throw error;
          } else if (["customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)
            && event.data.object.metadata?.["kind"] === "cometx_membership") {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { error } = await supabaseAdmin.rpc("sync_cometx_membership_subscription", {
              p_subscription: JSON.parse(JSON.stringify(event.data.object)),
            });
            if (error) throw error;
          } else if (event.data.object.metadata?.["kind"] === "ticket_checkout_batch") {
            const { applyTicketCheckoutBatchPaymentEvent } = await import("@/lib/ticket-orders.server");
            await applyTicketCheckoutBatchPaymentEvent(event.type, event.data.object);
          } else if (event.data.object.metadata?.["kind"] === "ticket_order") {
            const { applyTicketOrderPaymentEvent } = await import("@/lib/ticket-orders.server");
            await applyTicketOrderPaymentEvent(event.type,event.data.object);
          } else if (event.data.object.metadata?.["kind"] === "ticket_checkout") {
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
