/**
 * Minimal Stripe REST client built on fetch.
 * No SDK dependency, which keeps the app Cloudflare Workers compatible.
 * TEST MODE: use sk_test_... keys only for the prototype.
 */

const STRIPE_API = "https://api.stripe.com/v1";

export function getStripeSecretKey(): string {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) {
    throw new Error(
      "Stripe is not configured yet. Add STRIPE_SECRET_KEY (test mode) to enable checkout.",
    );
  }
  if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
    throw new Error("This prototype only accepts Stripe test-mode keys.");
  }
  return key;
}

export function isStripeConfigured(): boolean {
  const key = process.env["STRIPE_SECRET_KEY"] ?? "";
  return key.startsWith("sk_test_") || key.startsWith("rk_test_");
}

export class StripeRequestError extends Error {
  constructor(public status: number) { super(`Payment service request failed (${status}).`); }
}

function encodeForm(obj: Record<string, unknown>, prefix = ""): string[] {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === "object" && !Array.isArray(value)) {
      parts.push(...encodeForm(value as Record<string, unknown>, name));
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === "object" && item !== null) {
          parts.push(...encodeForm(item as Record<string, unknown>, `${name}[${index}]`));
        } else {
          parts.push(`${encodeURIComponent(`${name}[${index}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else {
      parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts;
}

export async function stripeRequest<T>(
  path: string,
  body?: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<T> {
  const response = await fetch(`${STRIPE_API}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${getStripeSecretKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2026-08-26.dahlia",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: body ? encodeForm(body).join("&") : null,
  });

  const json = (await response.json()) as { error?: { message?: string } };
  if (!response.ok) {
    throw new StripeRequestError(response.status);
  }
  return json as T;
}

export type CheckoutSession = { id: string; url: string };

export async function createCheckoutSession(params: {
  amount: number;
  currency: string;
  productName: string;
  description?: string | undefined;
  customerEmail?: string | null | undefined;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}): Promise<CheckoutSession> {
  return stripeRequest<CheckoutSession>("/checkout/sessions", {
    mode: "payment",
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    customer_email: params.customerEmail ?? undefined,
    "line_items[0][quantity]": 1,
    "line_items[0][price_data][currency]": params.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": Math.round(params.amount * 100),
    "line_items[0][price_data][product_data][name]": params.productName,
    "line_items[0][price_data][product_data][description]": params.description ?? undefined,
    metadata: {
      ...params.metadata,
      expected_amount: String(Math.round(params.amount * 100)),
      expected_currency: params.currency.toLowerCase(),
    },
    "payment_intent_data[metadata]": params.metadata,
  });
}

/** Constant-time-ish comparison for hex signatures. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Verifies the Stripe-Signature header. Throws when the payload cannot be trusted. */
export async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  toleranceSeconds = 300,
): Promise<unknown> {
  const secret = process.env["STRIPE_WEBHOOK_SECRET"];
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  if (!signatureHeader) throw new Error("Missing Stripe-Signature header.");

  const parts = signatureHeader.split(",").map((part) => part.trim().split("="));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value ?? "");
  if (!timestamp || !/^\d+$/.test(timestamp) || !signatures.length) throw new Error("Malformed Stripe-Signature header.");

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) {
    throw new Error("Stripe webhook timestamp outside tolerance.");
  }

  const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  if (!signatures.some((signature) => safeEqual(expected, signature))) throw new Error("Invalid Stripe webhook signature.");

  return JSON.parse(rawBody);
}
