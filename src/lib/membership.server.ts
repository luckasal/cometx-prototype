import { getReadClient, assertDatabaseResult } from "./database.server";
import type { EntitlementMap } from "./pricing";
import { entitlementValueIn, hasEntitlementIn } from "./pricing";

export type CurrentMembership = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string | null;
  plan: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    annualPrice: number;
    currency: string;
  };
};

/** The single source of truth for "what membership does this user have right now". */
export async function getCurrentMembership(
  userId: string | null | undefined,
): Promise<CurrentMembership | null> {
  if (!userId) return null;
  const { data, error } = await getReadClient()
    .from("memberships")
    .select(
      "id,status,starts_at,ends_at,membership_plans(id,name,slug,description,annual_price,currency)",
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .lte("starts_at", new Date().toISOString())
    .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  assertDatabaseResult({ error });
  if (!data || !data.membership_plans) return null;
  const now = new Date();
  if (data.ends_at && new Date(data.ends_at) < now) return null;

  const plan = data.membership_plans;
  return {
    id: data.id,
    status: data.status,
    startsAt: data.starts_at,
    endsAt: data.ends_at,
    plan: {
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      annualPrice: Number(plan.annual_price),
      currency: plan.currency,
    },
  };
}

/** Flattened entitlement key -> value map for the user's active membership. */
export async function getUserEntitlements(
  userId: string | null | undefined,
): Promise<EntitlementMap> {
  const membership = await getCurrentMembership(userId);
  if (!membership) return {};
  return getPlanEntitlements(membership.plan.id);
}

export async function getPlanEntitlements(planId: string): Promise<EntitlementMap> {
  const { data, error } = await getReadClient()
    .from("plan_entitlements")
    .select("value,entitlements(key)")
    .eq("membership_plan_id", planId);

  assertDatabaseResult({ error });
  if (!data) return {};
  const map: EntitlementMap = {};
  for (const row of data) {
    const key = row.entitlements?.key;
    if (key) map[key] = row.value === null ? null : Number(row.value);
  }
  return map;
}

export async function hasEntitlement(userId: string | null | undefined, key: string) {
  return hasEntitlementIn(await getUserEntitlements(userId), key);
}

export async function getEntitlementValue(userId: string | null | undefined, key: string) {
  return entitlementValueIn(await getUserEntitlements(userId), key);
}
