import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { stripeRequest, isStripeConfigured } from "./stripe.server";
import { checkoutOrigin } from "./checkout";
import { configuredAppUrl } from "./deployment";
import { createTicketPriceDataLineItem } from "./ticket-order";

const db = supabaseAdmin as unknown as SupabaseClient;
const checkoutSchema = z.object({
  id: z.string().uuid(), quantity: z.number().int(), amount_minor: z.number().int().nonnegative(),
  currency: z.string(), session_id: z.string().nullable(), session_url: z.string().nullable(),
  expires_at: z.string(), status: z.enum(["pending", "processing", "paid", "free", "expired", "failed"]),
});
function check(error: unknown) { if (error) throw new Error("Could not save payment data. Please retry or contact CometX."); }

export async function startTicketPayment(user: { userId: string; email: string | null }, ticketId: string, quantity: number) {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) throw new Error("Choose between 1 and 10 tickets.");
  const { data: ticket, error: ticketError } = await supabaseAdmin.from("ticket_types")
    .select("event_id,name,events(slug)").eq("id", ticketId).single();
  check(ticketError);
  if (!ticket?.events) throw new Error("Ticket unavailable.");
  const ready = isStripeConfigured() && !!process.env["STRIPE_WEBHOOK_SECRET"] && !!configuredAppUrl(process.env);
  if (ready) checkoutOrigin(configuredAppUrl(process.env));
  const { data, error } = await db.rpc("begin_ticket_checkout", {
    p_user_id: user.userId, p_ticket_id: ticketId, p_quantity: quantity, p_payments_ready: ready,
  });
  if (error) throw new Error(error.code === "P0001" ? error.message : "Unable to reserve this ticket.");
  const hold = checkoutSchema.parse(data);
  if (hold.status === "free" || hold.status === "paid") return { url: null, registrationId: null };
  if (hold.status === "processing") throw new Error("Your payment is processing. Check My events shortly.");
  if (hold.session_url) return { url: hold.session_url, registrationId: null };
  if (!isStripeConfigured() || !process.env["STRIPE_WEBHOOK_SECRET"]) {
    throw new Error("Online payment setup is not complete. Your place is pending; please contact CometX.");
  }
  const origin = checkoutOrigin(configuredAppUrl(process.env));
  let lineItem: ReturnType<typeof createTicketPriceDataLineItem>;
  try {
    lineItem = createTicketPriceDataLineItem({
      ticketName: ticket.name, unitAmountMinor: hold.amount_minor, currency: hold.currency, quantity: hold.quantity,
    });
  } catch {
    const released = await db.rpc("release_unstarted_ticket_checkout", { p_checkout_id: hold.id });
    check(released.error);
    throw new Error("Ticket checkout could not be prepared. Your place was released; please try again later.");
  }
  const expires = Math.floor(Date.parse(hold.expires_at) / 1000);
  // Do not create a second session after uncertainty. Reconcile/expire this hold first.
  if (expires < Date.now() / 1000 + 3600) throw new Error("Checkout needs reconciliation. Please contact CometX; no new payment was created.");
  const session = z.object({ id: z.string(), url: z.string().url(), livemode: z.literal(false) }).parse(
    await stripeRequest("/checkout/sessions", {
      mode: "payment", line_items: [lineItem], expires_at: expires,
      customer_email: user.email ?? undefined,
      success_url: `${origin}/account/events`, cancel_url: `${origin}/events/${encodeURIComponent(ticket.events.slug)}`,
      metadata: { kind: "ticket_checkout", checkout_id: hold.id, user_id: user.userId },
    }, `ticket_checkout_${hold.id}`),
  );
  if (new URL(session.url).hostname !== "checkout.stripe.com") throw new Error("Invalid checkout destination.");
  const saved = await db.from("ticket_checkouts").update({ session_id: session.id, session_url: session.url })
    .eq("id", hold.id).is("session_id", null);
  check(saved.error);
  return { url: session.url, registrationId: null };
}

export async function applyTicketPaymentEvent(type: string, session: unknown) {
  const result = await db.rpc("apply_ticket_checkout_event", { p_type: type, p_session: session });
  check(result.error);
}
