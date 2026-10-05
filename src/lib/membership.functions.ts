import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PlanSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  annualPrice: number;
  currency: string;
  benefits: { key: string; name: string; description: string | null; value: number | null }[];
};

export const getMembershipPlans = createServerFn({ method: "GET" }).handler(
  async (): Promise<PlanSummary[]> => {
    const { getReadClient } = await import("./database.server");
    const supabaseAdmin = getReadClient();
    const { data } = await supabaseAdmin
      .from("membership_plans")
      .select(
        "id,name,slug,description,annual_price,currency,sort_order,plan_entitlements(value,entitlements(key,name,description))",
      )
      .eq("active", true)
      .order("sort_order");

    return (data ?? []).map((plan) => ({
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      annualPrice: Number(plan.annual_price),
      currency: plan.currency,
      benefits: (plan.plan_entitlements ?? [])
        .filter((pe) => pe.entitlements)
        .map((pe) => ({
          key: pe.entitlements!.key,
          name: pe.entitlements!.name,
          description: pe.entitlements!.description,
          value: pe.value === null ? null : Number(pe.value),
        })),
    }));
  },
);

export type AccountOverview = {
  profile: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    company: string | null;
    jobTitle: string | null;
    country: string | null;
  };
  isAdmin: boolean;
  membership: {
    planName: string;
    planSlug: string;
    status: string;
    endsAt: string | null;
    benefits: { key: string; name: string; value: number | null }[];
  } | null;
};

export const getAccountOverview = createServerFn({ method: "GET" }).handler(
  async (): Promise<AccountOverview> => {
    const { requireUser, isAdmin } = await import("./auth.server");
    const { getReadClient } = await import("./database.server");
    const supabaseAdmin = getReadClient();
    const { getCurrentMembership, getPlanEntitlements } = await import("./membership.server");

    const user = await requireUser();

    const [{ data: profile }, membership] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", user.userId).maybeSingle(),
      getCurrentMembership(user.userId),
    ]);

    let benefits: AccountOverview["membership"] extends null
      ? never
      : { key: string; name: string; value: number | null }[] = [];

    if (membership) {
      const map = await getPlanEntitlements(membership.plan.id);
      const { data: entitlementRows } = await supabaseAdmin
        .from("entitlements")
        .select("key,name")
        .in("key", Object.keys(map).length ? Object.keys(map) : ["__none__"]);
      benefits = (entitlementRows ?? []).map((e) => ({
        key: e.key,
        name: e.name,
        value: map[e.key] ?? null,
      }));
    }

    return {
      profile: {
        id: user.userId,
        firstName: profile?.first_name ?? null,
        lastName: profile?.last_name ?? null,
        email: profile?.email ?? user.email,
        phone: profile?.phone ?? null,
        company: profile?.company ?? null,
        jobTitle: profile?.job_title ?? null,
        country: profile?.country ?? null,
      },
      isAdmin: await isAdmin(user.userId),
      membership: membership
        ? {
            planName: membership.plan.name,
            planSlug: membership.plan.slug,
            status: membership.status,
            endsAt: membership.endsAt,
            benefits,
          }
        : null,
    };
  },
);

export const updateMyProfile = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        first_name: z.string().max(80).nullable().default(null),
        last_name: z.string().max(80).nullable().default(null),
        phone: z.string().max(40).nullable().default(null),
        company: z.string().max(120).nullable().default(null),
        job_title: z.string().max(120).nullable().default(null),
        country: z.string().max(80).nullable().default(null),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireUser } = await import("./auth.server");
    const { getReadClient } = await import("./database.server");
    const supabaseAdmin = getReadClient();
    const user = await requireUser();
    const { error } = await supabaseAdmin.from("profiles").update(data).eq("id", user.userId);
    if (error) throw new Error("We could not save your profile. Please try again.");
    return { ok: true };
  });

/** A membership is granted only by the signed Stripe webhook after payment. */
export const startMembershipCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ planSlug: z.string().min(1).max(80) }).parse(data))
  .handler(async ({ data }) => {
    const { requireUser } = await import("./auth.server");
    const { getReadClient, assertDatabaseResult } = await import("./database.server");
    const { getCurrentMembership } = await import("./membership.server");
    const { isStripeConfigured, stripeRequest } = await import("./stripe.server");
    const { getMembershipCheckoutPrice } = await import("./membership-payments.server");
    const { configuredAppUrl } = await import("./deployment");
    const { checkoutOrigin } = await import("./checkout");
    const user = await requireUser();
    if (await getCurrentMembership(user.userId)) {
      throw new Error("You already have an active membership. Please contact CometX to change your plan.");
    }
    if (!isStripeConfigured() || !process.env["STRIPE_WEBHOOK_SECRET"]) {
      throw new Error("Online payment is temporarily unavailable. Please try again later.");
    }
    const { data: plan, error } = await getReadClient().from("membership_plans")
      .select("id,name,annual_price,currency,active,stripe_price_id")
      .eq("slug", data.planSlug).eq("active", true).maybeSingle();
    assertDatabaseResult({ error });
    if (!plan || !Number.isFinite(Number(plan.annual_price)) || Number(plan.annual_price) <= 0 || plan.currency.toUpperCase() !== "CHF") {
      throw new Error("This membership plan is not available for online payment.");
    }
    const origin = checkoutOrigin(configuredAppUrl(process.env));
    const priceId = await getMembershipCheckoutPrice({
      stripePriceId: plan.stripe_price_id,
      amount: Number(plan.annual_price),
      currency: plan.currency,
    });
    const metadata = {
      kind: "membership", membership_plan_id: plan.id, user_id: user.userId,
      expected_amount: String(Math.round(Number(plan.annual_price) * 100)),
      expected_currency: plan.currency.toLowerCase(),
    };
    const session = await stripeRequest<{ id: string; url: string; livemode: boolean }>("/checkout/sessions", {
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email ?? undefined,
      customer_creation: "always",
      success_url: `${origin}/account/membership?checkout=success`,
      cancel_url: `${origin}/account/membership?checkout=cancelled`,
      metadata,
      payment_intent_data: { metadata },
    });
    if (session.livemode !== false || !session.id.startsWith("cs_test_") || new URL(session.url).hostname !== "checkout.stripe.com") {
      throw new Error("Payment checkout could not be prepared safely.");
    }
    return { url: session.url };
  });
