import { calculateTicketPrice, type PriceResult } from "./pricing.ts";

export type PreviewPlan = {
  id: string;
  name: string;
  slug: string;
  plan_entitlements: { value: number | null; entitlements: { key: string; name: string } | null }[];
};

export type PreviewTicket = {
  base_price: string;
  member_price: string;
  currency: string;
  required_entitlement: string;
  discount_entitlement: string;
  free_entitlement: string;
};

export type PlanTicketPreview = {
  name: string;
  eligible: boolean;
  price: PriceResult | null;
  optionalWorkshopCredit: number | null;
};

export function previewTicketByPlan(
  ticket: PreviewTicket,
  eventType: string,
  plans: PreviewPlan[],
): PlanTicketPreview[] {
  const basePrice = Number(ticket.base_price);
  if (ticket.base_price.trim() === "" || !Number.isFinite(basePrice) || basePrice < 0) return [];
  const memberPrice = ticket.member_price.trim() === "" ? null : Number(ticket.member_price);
  if (memberPrice !== null && (!Number.isFinite(memberPrice) || memberPrice < 0)) return [];
  return plans.map((plan) => {
    const entitlements = Object.fromEntries(
      plan.plan_entitlements
        .filter((item) => item.entitlements?.key)
        .map((item) => [item.entitlements!.key, item.value]),
    );
    const optionalWorkshopCredit =
      eventType === "workshop" &&
      ticket.currency.toUpperCase() === "CHF" &&
      (plan.slug === "cometxxl" || plan.slug === "ambasador") &&
      entitlements["workshop_credit"] === (plan.slug === "cometxxl" ? 100 : 300)
        ? Number(entitlements["workshop_credit"])
        : null;
    // Workshop credit is opt-in at cart. Do not show it as the default ticket price.
    const defaultEntitlements = { ...entitlements };
    if ("workshop_credit" in defaultEntitlements) defaultEntitlements["workshop_credit"] = null;
    const price = calculateTicketPrice(
      {
        basePrice,
        currency: ticket.currency,
        memberPrice,
        requiredEntitlement: ticket.required_entitlement || null,
        discountEntitlement: ticket.discount_entitlement || null,
        freeEntitlement: ticket.free_entitlement || null,
      },
      defaultEntitlements,
      eventType,
      plan.slug,
    );
    return {
      name: plan.name,
      eligible: price.eligible,
      price: price.eligible ? price : null,
      optionalWorkshopCredit:
        price.eligible && price.benefitType === "public" ? optionalWorkshopCredit : null,
    };
  });
}
