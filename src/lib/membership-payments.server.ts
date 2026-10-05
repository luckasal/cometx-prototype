import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isStripeConfigured, stripeRequest } from "./stripe.server";

const providerProduct = z.object({ id: z.string(), livemode: z.literal(false) });
const providerPrice = z.object({
  id: z.string(),
  active: z.boolean(),
  livemode: z.literal(false),
  currency: z.string(),
  unit_amount: z.number().int(),
  type: z.enum(["one_time", "recurring"]),
  recurring: z.object({ interval: z.string(), interval_count: z.number() }).nullable().optional(),
});

export type MembershipCheckoutPriceLine = { price: string; quantity: 1 };

async function verifyPrice(input: {
  priceId: string | null;
  amount: number;
  currency: string;
  type: "one_time" | "recurring";
  interval?: string;
}) {
  if (!input.priceId) throw new Error("This membership is not ready for online payment. Please try again later.");
  const current = providerPrice.safeParse(await stripeRequest(`/prices/${input.priceId}`));
  const correctInterval = input.type !== "recurring" || current.success
    && current.data.recurring?.interval === input.interval
    && current.data.recurring?.interval_count === 1;
  if (!current.success || !current.data.active || current.data.type !== input.type || !correctInterval
    || current.data.currency.toUpperCase() !== input.currency.toUpperCase()
    || current.data.unit_amount !== Math.round(input.amount * 100)) {
    throw new Error("Online payment for this membership is temporarily unavailable. Please try again later.");
  }
  return current.data.id;
}

/** Revalidates Stripe's saved test prices before building customer Checkout line items. */
export async function getMembershipCheckoutPrices(input: {
  stripePriceId: string | null;
  recurringPriceId: string | null;
  setupPriceId: string | null;
  amount: number;
  setupFee: number;
  currency: string;
  interval: string | null;
}): Promise<MembershipCheckoutPriceLine[]> {
  if (input.interval) {
    if (input.interval !== "year") throw new Error("This membership billing interval is not supported yet.");
    const recurring = await verifyPrice({
      priceId: input.recurringPriceId,
      amount: input.amount,
      currency: input.currency,
      type: "recurring",
      interval: input.interval,
    });
    const lines: MembershipCheckoutPriceLine[] = [{ price: recurring, quantity: 1 }];
    if (input.setupFee > 0) {
      const setup = await verifyPrice({
        priceId: input.setupPriceId,
        amount: input.setupFee,
        currency: input.currency,
        type: "one_time",
      });
      lines.push({ price: setup, quantity: 1 });
    }
    return lines;
  }
  return [{
    price: await verifyPrice({
      priceId: input.stripePriceId,
      amount: input.amount,
      currency: input.currency,
      type: "one_time",
    }),
    quantity: 1,
  }];
}

/** Stripe Prices are immutable snapshots; Supabase remains the price source of truth. */
export async function ensureMembershipPrice(planId: string): Promise<string> {
  if (!isStripeConfigured()) throw new Error("Stripe test mode is not configured.");
  const { data: plan, error } = await supabaseAdmin
    .from("membership_plans")
    .select("id,name,slug,description,active,annual_price,currency,stripe_price_id,billing_interval,setup_fee,stripe_recurring_price_id,stripe_setup_price_id")
    .eq("id", planId)
    .single();
  if (error || !plan) throw new Error("Membership plan could not be loaded for payment setup.");
  const amountMinor = Math.round(Number(plan.annual_price) * 100);
  const setupMinor = Math.round(Number(plan.setup_fee) * 100);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || !Number.isSafeInteger(setupMinor) || setupMinor < 0 || plan.currency.toUpperCase() !== "CHF") {
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
      name,
      description: plan.description ?? "",
      active: plan.active,
      metadata,
    });
  } else {
    productId = providerProduct.parse(await stripeRequest("/products", {
      name,
      description: plan.description ?? undefined,
      type: "service",
      active: plan.active,
      metadata,
    }, `membership_product_${plan.id}`)).id;
  }

  const prices = await stripeRequest<{ data: unknown[] }>(`/prices?product=${encodeURIComponent(productId!)}&active=true&limit=100`);
  const parsed = prices.data.map((price) => providerPrice.safeParse(price)).filter((result) => result.success).map((result) => result.data);

  if (plan.billing_interval) {
    if (plan.billing_interval !== "year") throw new Error("Only annual recurring memberships are currently supported.");
    let recurring = parsed.find((price) => price.type === "recurring"
      && price.currency.toUpperCase() === plan.currency.toUpperCase()
      && price.unit_amount === amountMinor
      && price.recurring?.interval === "year"
      && price.recurring.interval_count === 1);
    if (!recurring) {
      recurring = providerPrice.parse(await stripeRequest("/prices", {
        product: productId,
        currency: plan.currency.toLowerCase(),
        unit_amount: amountMinor,
        recurring: { interval: "year", interval_count: 1 },
        metadata: { ...metadata, billing: "annual" },
      }, `membership_recurring_price_${plan.id}_${plan.currency}_${amountMinor}`));
    }

    let setup = plan.setup_fee > 0 ? parsed.find((price) => price.type === "one_time"
      && price.currency.toUpperCase() === plan.currency.toUpperCase()
      && price.unit_amount === setupMinor) : null;
    if (plan.setup_fee > 0 && !setup) {
      setup = providerPrice.parse(await stripeRequest("/prices", {
        product: productId,
        currency: plan.currency.toLowerCase(),
        unit_amount: setupMinor,
        metadata: { ...metadata, billing: "one_time_setup_fee" },
      }, `membership_setup_price_${plan.id}_${plan.currency}_${setupMinor}`));
    }
    const saved = await supabaseAdmin.from("membership_plans").update({
      stripe_recurring_price_id: recurring.id,
      stripe_setup_price_id: setup?.id ?? null,
    }).eq("id", plan.id);
    if (saved.error) throw new Error("Membership payment prices could not be saved.");
    return recurring.id;
  }

  let price = parsed.find((item) => item.type === "one_time"
    && item.currency.toUpperCase() === plan.currency.toUpperCase()
    && item.unit_amount === amountMinor);
  if (!price) {
    price = providerPrice.parse(await stripeRequest("/prices", {
      product: productId,
      currency: plan.currency.toLowerCase(),
      unit_amount: amountMinor,
      metadata: { ...metadata, billing: "one_time" },
    }, `membership_price_${plan.id}_${plan.currency}_${amountMinor}`));
  }
  const saved = await supabaseAdmin.from("membership_plans").update({ stripe_price_id: price.id }).eq("id", plan.id);
  if (saved.error) throw new Error("Membership payment price could not be saved.");
  return price.id;
}

export async function syncMembershipProduct(planId: string): Promise<boolean> {
  if (!isStripeConfigured()) return false;
  await ensureMembershipPrice(planId);
  return true;
}
