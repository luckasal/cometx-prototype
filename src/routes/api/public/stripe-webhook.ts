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
      if (["checkout.session.completed", "checkout.session.async_payment_succeeded","checkout.session.expired","checkout.session.async_payment_failed", "customer.subscription.updated", "customer.subscription.deleted", "invoice.paid"].includes(event.type)) {
        try {
          if (event.type === "invoice.paid") {
            const invoice = event.data.object;
            const parent = invoice["parent"] as Record<string, unknown> | undefined;
            const subscriptionDetails = parent?.["subscription_details"] as Record<string, unknown> | undefined;
            const metadata = subscriptionDetails?.["metadata"] as Record<string, string> | undefined;
            if (metadata?.["kind"] === "cometx_membership") {
              const invoiceId = invoice["id"];
              if (typeof invoiceId !== "string" || !invoiceId.startsWith("in_")) throw new Error("Invalid membership invoice");
              const { stripeRequest } = await import("@/lib/stripe.server");
              const expanded = await stripeRequest<Record<string, unknown>>(
                `/invoices/${encodeURIComponent(invoiceId)}?expand%5B%5D=payments.data.payment.payment_intent`,
              );
              const paymentRows = (expanded["payments"] as { data?: Array<{ payment?: { payment_intent?: string | { id?: string } } }> } | undefined)?.data;
              const paymentIntent = paymentRows?.map((row) => row.payment?.payment_intent)
                .find((intent) => typeof intent === "string" || (intent && typeof intent.id === "string"));
              const invoiceWithPayment = {
                ...expanded,
                cometx_payment_intent_id: typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id,
              };
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              const { error } = await supabaseAdmin.rpc("record_cometx_membership_invoice_paid", {
                p_invoice: JSON.parse(JSON.stringify(invoiceWithPayment)),
              });
              if (error) throw error;
            }
          } else if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)
            && event.data.object.metadata?.["kind"] === "membership_application") {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { error } = await supabaseAdmin.rpc("fulfill_cometx_membership_application", {
              p_session: JSON.parse(JSON.stringify(event.data.object)),
            });
            if (error) throw error;
            // Align access dates with Stripe's actual subscription-item period.
            const subscriptionId = event.data.object["subscription"];
            if (typeof subscriptionId !== "string" || !subscriptionId.startsWith("sub_")) throw new Error("Missing membership subscription");
            const { stripeRequest } = await import("@/lib/stripe.server");
            const subscription = await stripeRequest<Record<string, unknown>>(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
            const { error: syncError } = await supabaseAdmin.rpc("sync_cometx_membership_subscription", {
              p_subscription: JSON.parse(JSON.stringify(subscription)),
            });
            if (syncError) throw syncError;
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
