import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkoutOrigin } from "./checkout";
import { isStripeConfigured, stripeRequest } from "./stripe.server";

const db = supabaseAdmin as unknown as SupabaseClient;
type TicketEvent = { title: string; slug: string; start_date: string; venue: string | null };
type TicketCode = { id: string; ticket_code: string; attendee_name: string; status: string };
type TicketOrderLine = { id: string; ticket_name: string; quantity: number; unit_amount_minor: number; currency: string; ticket_attendees: TicketCode[] };
export type GuestTicketOrder = { id: string; buyer_name: string; buyer_email: string; amount_minor: number; currency: string; status: string; created_at: string; event_id: string; events: TicketEvent[]; ticket_order_items: TicketOrderLine[] };
export type MemberTicketOrder = { id: string; event_id: string; amount_minor: number; currency: string; status: string; created_at: string; events: TicketEvent[]; ticket_order_items: TicketOrderLine[] };
export type AdminTicketOrder = { id: string; buyer_name: string; buyer_email: string; buyer_kind: string; amount_minor: number; currency: string; status: string; created_at: string; events: { title: string }[]; ticket_order_items: { ticket_name: string; quantity: number; ticket_attendees: { attendee_name: string; attendee_email: string; ticket_code: string; status: string }[] }[]; payments: { status: string }[] };
const orderSchema = z.object({
  id: z.string().uuid(), event_id: z.string().uuid(), amount_minor: z.coerce.number().int().nonnegative(),
  currency: z.string().length(3), status: z.enum(["pending", "free"]), expires_at: z.string(),
});
const sessionSchema = z.object({ id: z.string(), url: z.string().url(), livemode: z.literal(false) });
const checkoutLinesSchema = z.array(z.object({ ticketId: z.string().uuid(), quantity: z.number().int().min(1).max(10) }))
  .min(1).max(10).superRefine((lines, ctx) => {
    if (new Set(lines.map((x) => x.ticketId)).size !== lines.length) ctx.addIssue({ code: "custom", message: "Choose each ticket type once." });
    if (lines.reduce((sum, x) => sum + x.quantity, 0) > 10) ctx.addIssue({ code: "custom", message: "Choose no more than 10 tickets per order." });
  });

function check(error: unknown): void {
  if (error) throw new Error("Ticket order could not be saved. Please try again.");
}
function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function fromBase64(text: string): Uint8Array {
  const decoded = atob(text);
  const bytes = new Uint8Array(new ArrayBuffer(decoded.length));
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  return bytes;
}
async function sha256(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function encryptionKey(): Promise<CryptoKey> {
  const secret = process.env["GUEST_TICKET_TOKEN_SECRET"];
  if (!secret || secret.length < 32) throw new Error("Guest ticket access is not configured. Add GUEST_TICKET_TOKEN_SECRET.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function encryptToken(token: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), new TextEncoder().encode(token));
  return `${base64(iv)}.${base64(new Uint8Array(ciphertext))}`;
}
async function decryptToken(value: string): Promise<string> {
  const [iv, ciphertext] = value.split(".");
  if (!iv || !ciphertext) throw new Error("Invalid guest access record.");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) as Uint8Array<ArrayBuffer> }, await encryptionKey(), fromBase64(ciphertext) as Uint8Array<ArrayBuffer>);
  return new TextDecoder().decode(plain);
}

export async function startTicketOrder(input: {
  userId: string | null;
  lines: z.infer<typeof checkoutLinesSchema>;
  buyerName?: string;
  buyerEmail?: string;
}) {
  const lines = checkoutLinesSchema.parse(input.lines);
  if (!input.userId && (!process.env["RESEND_API_KEY"] || !process.env["RESEND_FROM_EMAIL"])) {
    throw new Error("Guest ticket email is not configured yet. Please sign in or try again later.");
  }
  const ready = isStripeConfigured() && !!process.env["STRIPE_WEBHOOK_SECRET"] && !!process.env["SITE_URL"];
  const origin = input.userId ? (ready ? checkoutOrigin(process.env["SITE_URL"]) : null) : checkoutOrigin(process.env["SITE_URL"]);
  const token = input.userId ? null : base64(crypto.getRandomValues(new Uint8Array(32))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  const tokenHash = token ? await sha256(token) : null;
  const tokenCiphertext = token ? await encryptToken(token) : null;

  const { data, error } = await db.rpc("begin_ticket_order", {
    p_user_id: input.userId,
    p_guest_name: input.buyerName ?? null,
    p_guest_email: input.buyerEmail ?? null,
    p_lines: lines.map((line) => ({ ticket_id: line.ticketId, quantity: line.quantity })),
    p_payments_ready: ready,
    p_guest_token_hash: tokenHash,
    p_guest_token_ciphertext: tokenCiphertext,
  });
  if (error) throw new Error(error.code === "P0001" ? error.message : "Ticket order could not be created.");
  const order = orderSchema.parse(data);
  const buyer = await db.from("ticket_orders").select("buyer_email").eq("id", order.id).single();
  check(buyer.error);
  if (!buyer.data) throw new Error("Order buyer information is unavailable.");
  const ticketUrl = token ? `${origin}/tickets/guest?order=${encodeURIComponent(order.id)}&token=${encodeURIComponent(token)}` : null;
  if (order.status === "free") {
    if (ticketUrl) {
      try { await sendGuestTicketEmail(order.id); }
      catch (error) { console.error("[ticket-email] free ticket confirmation failed", error); }
    }
    return { url: null, accessUrl: ticketUrl, orderId: order.id, free: true };
  }

  let createdSession = false;
  try {
    const { data: event, error: eventError } = await db.from("events").select("slug").eq("id", order.event_id).single();
    check(eventError);
    if (!event) throw new Error("Event is unavailable.");
    const { data: items, error: itemsError } = await db.from("ticket_order_items")
      .select("ticket_type_id,ticket_name,quantity,unit_amount_minor,currency").eq("order_id", order.id);
    check(itemsError);
    if (!items?.length) throw new Error("Order has no tickets.");
    const { syncEventPayments, ensureTicketPrice } = await import("./ticket-payments.server");
    await syncEventPayments(order.event_id);
    const lineItems = [];
    for (const item of items) {
      if (item.unit_amount_minor === 0) continue;
      const price = await ensureTicketPrice(item.ticket_type_id, Number(item.unit_amount_minor), item.currency);
      lineItems.push({ price, quantity: item.quantity });
    }
    if (!lineItems.length) throw new Error("Order amount did not match its ticket prices.");
    const success = input.userId
      ? `${origin}/account/events?purchase=success`
      : `${ticketUrl}&paid=1`;
    const session = sessionSchema.parse(await stripeRequest("/checkout/sessions", {
      mode: "payment", line_items: lineItems, expires_at: Math.floor(Date.parse(order.expires_at) / 1000),
      customer_email: buyer.data.buyer_email,
      customer_creation: "always",
      success_url: success,
      cancel_url: `${origin}/events/${encodeURIComponent(event.slug)}#event-ticket-options`,
      metadata: { kind: "ticket_order", order_id: order.id },
      payment_intent_data: { metadata: { kind: "ticket_order", order_id: order.id } },
    }, `ticket_order_${order.id}`));
    createdSession = true;
    if (new URL(session.url).hostname !== "checkout.stripe.com") throw new Error("Invalid checkout destination.");
    const saved = await db.rpc("save_ticket_checkout_session", { p_order_id: order.id, p_session_id: session.id });
    check(saved.error);
    return { url: session.url, accessUrl: ticketUrl, orderId: order.id, free: false };
  } catch (error) {
    if (!createdSession) {
      const failed = await db.rpc("fail_unstarted_ticket_order", { p_order_id: order.id });
      check(failed.error);
      throw error;
    }
    // A Session may already exist at Stripe; leave the capacity hold intact for webhook reconciliation.
    throw new Error("Checkout was created but could not be linked safely. Please contact CometX before trying again.");
  }
}

export async function applyTicketOrderPaymentEvent(type: string, session: unknown) {
  const result = await db.rpc("apply_ticket_order_event", { p_type: type, p_session: session });
  check(result.error);
  const parsed = z.object({ metadata: z.object({ order_id: z.string().uuid() }) }).passthrough().parse(session);
  await sendGuestTicketEmail(parsed.metadata.order_id);
}

export async function sendGuestTicketEmail(orderId: string): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["RESEND_FROM_EMAIL"];
  if (!apiKey || !from) return;
  const { data: order, error } = await db.from("ticket_orders")
    .select("id,buyer_name,buyer_email,status,guest_token_ciphertext,guest_email_sent_at")
    .eq("id", orderId).eq("buyer_kind", "guest").maybeSingle();
  check(error);
  if (!order || order.guest_email_sent_at || !["confirmed", "free"].includes(order.status) || !order.guest_token_ciphertext) return;
  const site = checkoutOrigin(process.env["SITE_URL"]);
  const token = await decryptToken(order.guest_token_ciphertext);
  const url = `${site}/tickets/guest?order=${encodeURIComponent(order.id)}&token=${encodeURIComponent(token)}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `cometx-ticket-order-${order.id}` },
    body: JSON.stringify({ from, to: [order.buyer_email], subject: "Your CometX event tickets", text: `Hi ${order.buyer_name},\n\nYour ticket order is confirmed. View your tickets securely here:\n${url}\n\nCometX`, html: `<p>Hi ${escapeHtml(order.buyer_name)},</p><p>Your ticket order is confirmed.</p><p><a href="${url}">View your CometX tickets</a></p><p>CometX</p>` }),
  });
  if (!response.ok) throw new Error("Guest ticket confirmation email could not be delivered.");
  const updated = await db.from("ticket_orders").update({ guest_email_sent_at: new Date().toISOString() }).eq("id", orderId).is("guest_email_sent_at", null);
  check(updated.error);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

function normalizeEventRelation<T extends { events?: unknown }>(row: T): T & { events: unknown[] } {
  const events = row.events;
  return { ...row, events: events == null ? [] : Array.isArray(events) ? events : [events] };
}

export async function getGuestTicketOrder(orderId: string, token: string) {
  const tokenHash = await sha256(token);
  const { data: order, error } = await db.from("ticket_orders")
    .select("id,buyer_name,buyer_email,amount_minor,currency,status,created_at,event_id,events(title,slug,start_date,venue),ticket_order_items(id,ticket_name,quantity,unit_amount_minor,currency,ticket_attendees(id,ticket_code,attendee_name,status))")
    .eq("id", orderId).eq("guest_token_hash", tokenHash).maybeSingle();
  check(error);
  if (!order) return null;
  return JSON.parse(JSON.stringify(normalizeEventRelation(order))) as GuestTicketOrder;
}

export async function getMyPurchasedTickets(userId: string) {
  const { data, error } = await db.from("ticket_orders")
    .select("id,event_id,amount_minor,currency,status,created_at,events(title,slug,start_date,venue),ticket_order_items(id,ticket_name,quantity,unit_amount_minor,currency,ticket_attendees(id,ticket_code,attendee_name,status))")
    .eq("user_id", userId).order("created_at", { ascending: false });
  check(error);
  return JSON.parse(JSON.stringify((data ?? []).map(normalizeEventRelation))) as MemberTicketOrder[];
}

export async function claimTicketOrder(orderId: string, token: string, userId: string) {
  const tokenHash = await sha256(token);
  const { data, error } = await db.rpc("claim_guest_ticket_order", { p_order_id: orderId, p_token_hash: tokenHash, p_user_id: userId });
  check(error);
  return data === true;
}

export async function listAdminTicketOrders() {
  const { data, error } = await db.from("ticket_orders")
    .select("id,buyer_name,buyer_email,buyer_kind,amount_minor,currency,status,created_at,events(title),ticket_order_items(ticket_name,quantity,ticket_attendees(attendee_name,attendee_email,ticket_code,status)),payments(status)")
    .order("created_at", { ascending: false }).limit(500);
  check(error);
  return JSON.parse(JSON.stringify((data ?? []).map(normalizeEventRelation))) as AdminTicketOrder[];
}
