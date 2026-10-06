import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PlanSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  annualPrice: number;
  currency: string;
  billingInterval: string | null;
  setupFee: number;
  benefits: { key: string; name: string; description: string | null; value: number | null }[];
};

export const getMembershipPlans = createServerFn({ method: "GET" }).handler(
  async (): Promise<PlanSummary[]> => {
    const { getReadClient } = await import("./database.server");
    const supabaseAdmin = getReadClient();
    const { data } = await supabaseAdmin
      .from("membership_plans")
      .select(
        "id,name,slug,description,annual_price,currency,billing_interval,setup_fee,sort_order,plan_entitlements(value,entitlements(key,name,description))",
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
      billingInterval: plan.billing_interval,
      setupFee: Number(plan.setup_fee),
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
    canManageBilling: boolean;
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
            canManageBilling: membership.hasStripeSubscription,
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
  .inputValidator((data: unknown) => z.object({
    planSlug: z.string().min(1).max(80),
    email: z.string().email().max(320).optional(),
    nationality: z.enum(["slovak", "czech", "other"]).optional(),
    motivation: z.string().trim().min(1).max(3000).optional(),
    missingFromSubscription: z.string().trim().min(1).max(3000).optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { requireUser } = await import("./auth.server");
    const { getReadClient, assertDatabaseResult } = await import("./database.server");
    const { getCurrentMembership } = await import("./membership.server");
    const { isStripeConfigured, stripeRequest } = await import("./stripe.server");
    const { getMembershipCheckoutPrices } = await import("./membership-payments.server");
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
      .select("id,name,annual_price,currency,active,stripe_price_id,billing_interval,setup_fee,stripe_recurring_price_id,stripe_setup_price_id")
      .eq("slug", data.planSlug).eq("active", true).maybeSingle();
    assertDatabaseResult({ error });
    if (!plan || !Number.isFinite(Number(plan.annual_price)) || Number(plan.annual_price) <= 0 || plan.currency.toUpperCase() !== "CHF") {
      throw new Error("This membership plan is not available for online payment.");
    }
    const origin = checkoutOrigin(configuredAppUrl(process.env));
    if (plan.billing_interval && (plan.billing_interval !== "year" || !data.email || !data.nationality || !data.motivation || !data.missingFromSubscription)) {
      throw new Error("Complete all required membership details before continuing.");
    }
    const lines = await getMembershipCheckoutPrices({
      stripePriceId: plan.stripe_price_id,
      recurringPriceId: plan.stripe_recurring_price_id,
      setupPriceId: plan.stripe_setup_price_id,
      amount: Number(plan.annual_price),
      setupFee: Number(plan.setup_fee),
      currency: plan.currency,
      interval: plan.billing_interval,
    });
    const amountMinor = Math.round((Number(plan.annual_price) + Number(plan.billing_interval ? plan.setup_fee : 0)) * 100);
    let applicationId: string | null = null;
    if (plan.billing_interval) {
      // The verified server request owns this write. The application table is
      // deliberately read-only to user-scoped clients; keep privileged access
      // on the server and bind the new row to the authenticated user above.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: application, error: applicationError } = await supabaseAdmin
        .from("membership_applications")
        .insert({
          user_id: user.userId,
          membership_plan_id: plan.id,
          email: data.email!,
          nationality: data.nationality!,
          motivation: data.motivation!,
          missing_from_subscription: data.missingFromSubscription!,
        })
        .select("id")
        .single();
      assertDatabaseResult({ error: applicationError });
      if (!application) throw new Error("Membership application could not be saved.");
      applicationId = application.id;
    }
    const metadata = {
      kind: applicationId ? "membership_application" : "membership",
      ...(applicationId ? { membership_application_id: applicationId } : {}),
      membership_plan_id: plan.id,
      user_id: user.userId,
      expected_amount: String(amountMinor),
      expected_currency: plan.currency.toLowerCase(),
    };
    const mode = plan.billing_interval ? "subscription" : "payment";
    const session = await stripeRequest<{ id: string; url: string; livemode: boolean; mode: string }>("/checkout/sessions", {
      mode,
      line_items: lines,
      customer_email: data.email ?? user.email ?? undefined,
      ...(!plan.billing_interval ? { customer_creation: "always", payment_intent_data: { metadata } } : {
        subscription_data: { metadata: {
          kind: "cometx_membership",
          membership_application_id: applicationId!,
          membership_plan_id: plan.id,
          user_id: user.userId,
        } },
      }),
      success_url: `${origin}/account/membership?checkout=success`,
      cancel_url: `${origin}/account/membership?checkout=cancelled`,
      metadata,
    }, applicationId ? `membership_checkout_${applicationId}` : undefined);
    if (session.livemode !== false || session.mode !== mode || !session.id.startsWith("cs_test_") || new URL(session.url).hostname !== "checkout.stripe.com") {
      throw new Error("Payment checkout could not be prepared safely.");
    }
    if (applicationId) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: saveError } = await supabaseAdmin.from("membership_applications")
        .update({ stripe_checkout_session_id: session.id })
        .eq("id", applicationId)
        .eq("user_id", user.userId);
      assertDatabaseResult({ error: saveError });
    }
    return { url: session.url };
  });

export const startMembershipBillingPortal = createServerFn({ method: "POST" }).handler(async () => {
  const { requireUser } = await import("./auth.server");
  const { getReadClient, assertDatabaseResult } = await import("./database.server");
  const { stripeRequest } = await import("./stripe.server");
  const { configuredAppUrl } = await import("./deployment");
  const { checkoutOrigin } = await import("./checkout");
  const user = await requireUser();
  const { data: membership, error } = await getReadClient()
    .from("memberships")
    .select("stripe_customer_id,stripe_subscription_id")
    .eq("user_id", user.userId)
    .eq("status", "active")
    .not("stripe_subscription_id", "is", null)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  assertDatabaseResult({ error });
  if (!membership?.stripe_customer_id) throw new Error("Billing management is not available for this membership.");
  const origin = checkoutOrigin(configuredAppUrl(process.env));
  const portal = await stripeRequest<{ url: string }>("/billing_portal/sessions", {
    customer: membership.stripe_customer_id,
    return_url: `${origin}/account/membership`,
  });
  if (new URL(portal.url).hostname !== "billing.stripe.com") {
    throw new Error("Billing management could not be prepared safely.");
  }
  return { url: portal.url };
});
