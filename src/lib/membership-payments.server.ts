import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isStripeConfigured, stripeRequest } from "./stripe.server";

const providerProduct = z.object({ id: z.string(), livemode: z.literal(false) });
const providerPrice = z.object({ id: z.string(), livemode: z.literal(false), currency: z.string(), unit_amount: z.number().int(), type: z.literal("one_time") });

/** Supabase sets the annual amount; Stripe Prices are immutable test-mode snapshots. */
export async function ensureMembershipPrice(planId: string): Promise<string> {
  if (!isStripeConfigured()) throw new Error("Stripe test mode is not configured.");
  const { data: plan, error } = await supabaseAdmin.from("membership_plans")
    .select("id,name,slug,description,active,annual_price,currency,stripe_price_id")
    .eq("id", planId).single();
  if (error || !plan) throw new Error("Membership plan could not be loaded for payment setup.");
  const amountMinor = Math.round(Number(plan.annual_price) * 100);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || plan.currency.toUpperCase() !== "CHF") {
    throw new Error("Membership plan price is not valid for online payment.");
  }

  const query = encodeURIComponent(`metadata['membership_plan_id']:'${plan.id}'`);
  const found = await stripeRequest<{ data: unknown[] }>(`/products/search?query=${query}&limit=1`);
  const name = `CometX membership — ${plan.name}`;
  const metadata = { membership_plan_id: plan.id, membership_plan_slug: plan.slug, source: "cometx" };
  const existing = found.data[0] ? providerProduct.parse(found.data[0]) : null;
  let productId = existing?.id;
  if (existing) {
    await stripeRequest(`/products/${existing.id}`, {
      name, description: plan.description ?? "", active: plan.active, metadata,
    });
  } else {
    productId = providerProduct.parse(await stripeRequest("/products", {
      name, description: plan.description ?? undefined, type: "service", active: plan.active, metadata,
    }, `membership_product_${plan.id}`)).id;
  }
  if (plan.stripe_price_id) {
    const current = providerPrice.safeParse(await stripeRequest(`/prices/${plan.stripe_price_id}`));
    if (current.success && current.data.currency.toUpperCase() === plan.currency.toUpperCase() && current.data.unit_amount === amountMinor) {
      return current.data.id;
    }
  }
  const prices = await stripeRequest<{ data: unknown[] }>(`/prices?product=${encodeURIComponent(productId!)}&active=true&limit=100`);
  const match = prices.data.map((p) => providerPrice.safeParse(p)).find((p) => p.success && p.data.currency.toUpperCase() === plan.currency.toUpperCase() && p.data.unit_amount === amountMinor);
  const priceId = match?.success ? match.data.id : providerPrice.parse(await stripeRequest("/prices", {
    product: productId, currency: plan.currency.toLowerCase(), unit_amount: amountMinor,
    metadata: { membership_plan_id: plan.id, source: "cometx" },
  }, `membership_price_${plan.id}_${plan.currency}_${amountMinor}`)).id;
  const saved = await supabaseAdmin.from("membership_plans").update({ stripe_price_id: priceId }).eq("id", plan.id);
  if (saved.error) throw new Error("Membership payment price could not be saved.");
  return priceId;
}

export async function syncMembershipProduct(planId: string): Promise<boolean> {
  if (!isStripeConfigured()) return false;
  await ensureMembershipPrice(planId);
  return true;
}
