import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { stripeRequest, isStripeConfigured } from "./stripe.server";
import { checkoutOrigin } from "./checkout";

// These private tables are intentionally not part of the public generated client schema.
const db = supabaseAdmin as unknown as SupabaseClient;
const checkoutSchema = z.object({
  id: z.string().uuid(), quantity:z.number().int(), amount_minor: z.number().int().nonnegative(),
  currency: z.string(), session_id: z.string().nullable(), session_url: z.string().nullable(),
  expires_at: z.string(), status: z.enum(["pending","processing","paid","free","expired","failed"]),
});
const providerSchema = z.object({ id: z.string(), livemode: z.literal(false) });
function check(error: unknown) { if (error) throw new Error("Could not save payment data. Please retry or contact CometX."); }

export async function ensureTicketPrice(ticketId: string, amountMinor: number, currency: string) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new Error("Invalid payment amount.");
  currency = currency.toLowerCase();
  const { data: mapping, error } = await db.from("ticket_payment_prices").select("price_id")
    .eq("ticket_id",ticketId).eq("amount_minor",amountMinor).eq("currency",currency).maybeSingle();
  check(error);
  if (mapping) return z.string().parse(mapping.price_id);
  // Lookup keys survive Stripe's 24h idempotency retention and DB-write retries.
  const {data:product,error:productError}=await db.from("ticket_payment_products").select("product_id").eq("ticket_id",ticketId).single();
  check(productError);
  if(!product) throw new Error("The ticket's payment product has not synced yet.");
  const lookup = `cometx_${ticketId}_${currency}_${amountMinor}`;
  const existing = await stripeRequest<{ data: unknown[] }>(`/prices?lookup_keys%5B%5D=${encodeURIComponent(lookup)}&limit=1`);
  const price = existing.data[0] ? providerSchema.parse(existing.data[0]) : providerSchema.parse(
    await stripeRequest("/prices", { product: product.product_id, unit_amount: amountMinor,
      currency, lookup_key: lookup }, lookup));
  const saved = await db.from("ticket_payment_prices").upsert({ ticket_id:ticketId, amount_minor:amountMinor,
    currency, product_id:product.product_id, price_id:price.id }, { onConflict:"ticket_id,amount_minor,currency" });
  check(saved.error);
  return price.id;
}

export async function syncEventPayments(eventId: string) {
  if (!isStripeConfigured()) return false;
  const { data: event, error } = await supabaseAdmin.from("events").select("title,publish_state").eq("id",eventId).single();
  check(error);
  if (!event) throw new Error("Event unavailable.");
  const tickets = await supabaseAdmin.from("ticket_types").select("*").eq("event_id",eventId);
  check(tickets.error);
  for (const ticket of tickets.data ?? []) {
    const active = ticket.active && event.publish_state === "published";
    const old=await db.from("ticket_payment_products").select("product_id").eq("ticket_id",ticket.id).maybeSingle();
    check(old.error);
    let productId=old.data?.product_id;
    if (!productId) {
      if (!active) continue;
      const query=encodeURIComponent(`metadata['ticket_id']:'${ticket.id}'`);
      const found=await stripeRequest<{data:unknown[]}>(`/products/search?query=${query}&limit=1`);
      const p=found.data[0] ? providerSchema.parse(found.data[0]) : providerSchema.parse(await stripeRequest("/products", { name:`${event.title} — ${ticket.name}`,
        metadata:{event_id:eventId,ticket_id:ticket.id},active:true }, `product_${ticket.id}`));
      productId=p.id;
      const saved=await db.from("ticket_payment_products").upsert({ticket_id:ticket.id,product_id:productId},{onConflict:"ticket_id"}); check(saved.error);
    }
    await stripeRequest(`/products/${productId}`, { name:`${event.title} — ${ticket.name}`,active });
    if (active) for (const amount of new Set([ticket.base_price,ticket.member_price])) {
      if (amount !== null && Number(amount)>0) await ensureTicketPrice(ticket.id,Math.round(Number(amount)*100),ticket.currency);
    }
  }
  return true;
}

export async function startTicketPayment(user: { userId:string; email:string|null }, ticketId:string,quantity:number) {
  if (!Number.isSafeInteger(quantity) || quantity<1 || quantity>10) throw new Error("Choose between 1 and 10 tickets.");
  const { data: ticket, error: ticketError } = await supabaseAdmin.from("ticket_types")
    .select("event_id,events(slug)").eq("id",ticketId).single();
  check(ticketError);
  if (!ticket?.events) throw new Error("Ticket unavailable.");
  const ready = isStripeConfigured() && !!process.env["STRIPE_WEBHOOK_SECRET"] && !!process.env["SITE_URL"];
  if (ready) checkoutOrigin(process.env["SITE_URL"]);
  const { data, error } = await db.rpc("begin_ticket_checkout", {p_user_id:user.userId,p_ticket_id:ticketId,p_quantity:quantity,p_payments_ready:ready});
  if (error) throw new Error(error.code === "P0001" ? error.message : "Unable to reserve this ticket.");
  const hold = checkoutSchema.parse(data);
  if (hold.status === "free" || hold.status === "paid") return { url:null, registrationId:null };
  if (hold.status === "processing") throw new Error("Your payment is processing. Check My events shortly.");
  if (hold.session_url) return { url:hold.session_url,registrationId:null };
  if (!isStripeConfigured() || !process.env["STRIPE_WEBHOOK_SECRET"]) {
    throw new Error("Online payment setup is not complete. Your place is pending; please contact CometX.");
  }
  const origin = checkoutOrigin(process.env["SITE_URL"]);
  let priceId: string;
  try {
    await syncEventPayments(ticket.event_id);
    priceId = await ensureTicketPrice(ticketId,hold.amount_minor,hold.currency);
  } catch {
    const released = await db.rpc("release_unstarted_ticket_checkout", { p_checkout_id: hold.id });
    check(released.error);
    throw new Error("Ticket checkout could not be prepared. Your place was released; please try again later.");
  }
  const expires = Math.floor(Date.parse(hold.expires_at)/1000);
  // Do not create a second session after uncertainty. Reconcile/expire this hold first.
  if (expires < Date.now()/1000 + 3600) throw new Error("Checkout needs reconciliation. Please contact CometX; no new payment was created.");
  const session = z.object({id:z.string(),url:z.string().url(),livemode:z.literal(false)}).parse(
    await stripeRequest("/checkout/sessions", {
      mode:"payment", line_items:[{price:priceId,quantity:hold.quantity}], expires_at:expires,
      customer_email:user.email ?? undefined,
      success_url:`${origin}/account/events`, cancel_url:`${origin}/events/${encodeURIComponent(ticket.events.slug)}`,
      metadata:{kind:"ticket_checkout",checkout_id:hold.id,user_id:user.userId},
    }, `ticket_checkout_${hold.id}`));
  if (new URL(session.url).hostname !== "checkout.stripe.com") throw new Error("Invalid checkout destination.");
  const saved = await db.from("ticket_checkouts").update({session_id:session.id,session_url:session.url})
    .eq("id",hold.id).is("session_id",null);
  check(saved.error);
  return {url:session.url,registrationId:null};
}

export async function applyTicketPaymentEvent(type:string,session:unknown) {
  const result = await db.rpc("apply_ticket_checkout_event",{p_type:type,p_session:session});
  check(result.error);
}
