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
  registrations: {
    id: string;
    status: string;
    pricePaid: number;
    currency: string;
    eventTitle: string;
    eventSlug: string;
    startDate: string;
    ticketName: string | null;
  }[];
  upcomingEvents: { title: string; slug: string; startDate: string }[];
};

export const getAccountOverview = createServerFn({ method: "GET" }).handler(
  async (): Promise<AccountOverview> => {
    const { requireUser, isAdmin } = await import("./auth.server");
    const { getReadClient } = await import("./database.server");
    const supabaseAdmin = getReadClient();
    const { getCurrentMembership, getPlanEntitlements } = await import("./membership.server");

    const user = await requireUser();

    const [{ data: profile }, membership, { data: regs }, { data: events }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", user.userId).maybeSingle(),
      getCurrentMembership(user.userId),
      supabaseAdmin
        .from("registrations")
        .select("id,status,price_paid,currency,events(title,slug,start_date),ticket_types(name)")
        .eq("user_id", user.userId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("events")
        .select("title,slug,start_date")
        .in("status", ["published", "registration_open"])
        .gte("start_date", new Date().toISOString())
        .order("start_date")
        .limit(4),
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
      registrations: (regs ?? [])
        .filter((r) => r.events)
        .map((r) => ({
          id: r.id,
          status: r.status,
          pricePaid: Number(r.price_paid),
          currency: r.currency,
          eventTitle: r.events!.title,
          eventSlug: r.events!.slug,
          startDate: r.events!.start_date,
          ticketName: r.ticket_types?.name ?? null,
        })),
      upcomingEvents: (events ?? []).map((e) => ({
        title: e.title,
        slug: e.slug,
        startDate: e.start_date,
      })),
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

/** Stakeholder prototype: persist plan selection without collecting payment. */
export const selectPrototypeMembership = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ planSlug: z.string().min(1).max(80) }).parse(data))
  .handler(async ({ data }) => {
    const { requireUser } = await import("./auth.server");
    await requireUser();
    const { getReadClient } = await import("./database.server");
    const { error } = await getReadClient().rpc("select_prototype_membership", { p_plan_slug: data.planSlug });
    if (error) throw new Error(error.code === "P0001" ? error.message : "Could not save your membership.");
    return { url: "/account/membership" };
  });
