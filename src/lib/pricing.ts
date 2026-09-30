/**
 * Pure, testable pricing + eligibility logic.
 * No database access here - callers load the data and pass it in.
 * The client never computes a price it can pay with; see events.functions.ts.
 */

export type EntitlementMap = Record<string, number | null>;

export type TicketPricingInput = {
  basePrice: number;
  currency: string;
  memberPrice?: number | null;
  requiredEntitlement?: string | null;
  discountEntitlement?: string | null;
  freeEntitlement?: string | null;
};

export type PriceResult = {
  basePrice: number;
  discount: number;
  finalPrice: number;
  currency: string;
  reason: string;
  includedInMembership: boolean;
  eligible: boolean;
  benefitType: "free" | "workshop_credit" | "percent_discount" | "member_price" | "public";
  benefitValue: number;
  membershipTier: string | null;
};

export function hasEntitlementIn(entitlements: EntitlementMap, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(entitlements, key);
}

export function entitlementValueIn(entitlements: EntitlementMap, key: string): number | null {
  return hasEntitlementIn(entitlements, key) ? (entitlements[key] ?? null) : null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculateTicketPrice(
  ticket: TicketPricingInput,
  entitlements: EntitlementMap,
  eventType = "regular_event",
  membershipTier: string | null = null,
): PriceResult {
  if (!Number.isFinite(ticket.basePrice) || ticket.basePrice < 0) throw new Error("Invalid ticket price.");
  const basePrice = round2(ticket.basePrice);
  const base: PriceResult = {
    basePrice,
    discount: 0,
    finalPrice: basePrice,
    currency: ticket.currency,
    reason: "Standard ticket",
    includedInMembership: false,
    eligible: true,
    benefitType: "public",
    benefitValue: 0,
    membershipTier,
  };

  if (ticket.requiredEntitlement && !hasEntitlementIn(entitlements, ticket.requiredEntitlement)) {
    return {
      ...base,
      eligible: false,
      reason: "This ticket is reserved for members with the required benefit",
    };
  }

  if (ticket.freeEntitlement && hasEntitlementIn(entitlements, ticket.freeEntitlement)) {
    return {
      ...base,
      discount: basePrice,
      finalPrice: 0,
      includedInMembership: true,
      reason: "Included in your membership",
      benefitType: "free",
      benefitValue: basePrice,
    };
  }

  const type = eventType === "event" ? "regular_event" : eventType;
  const tier = membershipTier?.toLowerCase() ?? null;
  const freeKey = type === "symposium" && (tier === "cometxxl" || tier === "ambasador")
    ? "symposium_free_ticket" : type === "potlach" && tier === "ambasador" ? "potlach_free_ticket" : null;
  if (freeKey && hasEntitlementIn(entitlements, freeKey)) {
    return { ...base, discount: basePrice, finalPrice: 0, includedInMembership: true,
      reason: "Included in your membership", benefitType: "free", benefitValue: basePrice };
  }

  if (type === "workshop" && (tier === "cometxxl" || tier === "ambasador") && ticket.currency.toUpperCase() === "CHF") {
    const configured = entitlementValueIn(entitlements, "workshop_credit");
    const credit = tier === "cometxxl" ? 100 : 300;
    if (configured === credit) {
      const discount = Math.min(basePrice, credit);
      return { ...base, discount, finalPrice: round2(basePrice - discount),
        reason: `Workshop credit −CHF ${discount}`, benefitType: "workshop_credit", benefitValue: discount };
    }
  }

  let tierDiscountKey: string | null = null;
  if (type === "symposium" && tier === "fanousek") tierDiscountKey = "symposium_half_price";
  else if (type === "regular_event" && tier === "cometxxl") tierDiscountKey = "other_events_discount";
  else if (type === "potlach" && tier) tierDiscountKey = "potlach_discount";

  const officialTier = tier === "fanousek" || tier === "cometxxl" || tier === "ambasador";
  const explicitDiscountKey = officialTier && (type === "workshop" || type === "potlach")
    ? (type === "potlach" && ticket.discountEntitlement === "potlach_discount" ? "potlach_discount" : null)
    : ticket.discountEntitlement;
  const discounts = [tierDiscountKey, explicitDiscountKey]
    .filter((key): key is string => !!key && hasEntitlementIn(entitlements, key))
    .map((key) => entitlementValueIn(entitlements, key) ?? 0);
  if (discounts.some((value) => !Number.isFinite(value))) throw new Error("Invalid membership discount.");
  const pct = Math.min(100, Math.max(0, ...discounts));
  const percentagePrice = round2(basePrice - round2(basePrice * pct / 100));
  const explicitPrice = tier && type !== "workshop" && ticket.memberPrice != null
    ? round2(ticket.memberPrice) : null;
  if (explicitPrice !== null && (!Number.isFinite(explicitPrice) || explicitPrice < 0)) throw new Error("Invalid member price.");
  if (pct > 0 || (explicitPrice !== null && explicitPrice < basePrice)) {
    const useExplicit = explicitPrice !== null && explicitPrice < percentagePrice;
    const finalPrice = useExplicit ? explicitPrice! : percentagePrice;
    return { ...base, discount: round2(basePrice - finalPrice), finalPrice,
      includedInMembership: finalPrice === 0,
      reason: useExplicit ? "Member ticket price" : `Member price (${pct}% off)`,
      benefitType: useExplicit ? "member_price" : "percent_discount",
      benefitValue: useExplicit ? round2(basePrice - finalPrice) : pct };
  }

  return base;
}

export type CapacityInput = {
  eventCapacity: number | null;
  ticketCapacity: number | null;
  eventConfirmedCount: number;
  ticketConfirmedCount: number;
};

export function hasCapacity(input: CapacityInput): boolean {
  if (input.eventCapacity !== null && input.eventConfirmedCount >= input.eventCapacity) return false;
  if (input.ticketCapacity !== null && input.ticketConfirmedCount >= input.ticketCapacity)
    return false;
  return true;
}

export type RegistrationWindow = {
  status: string;
  registrationStart: string | null;
  registrationEnd: string | null;
};

export function isRegistrationOpen(event: RegistrationWindow, now: Date = new Date()): boolean {
  if (event.status !== "registration_open") return false;
  if (!Number.isFinite(now.getTime())) return false;
  if (event.registrationStart && !Number.isFinite(Date.parse(event.registrationStart))) return false;
  if (event.registrationEnd && !Number.isFinite(Date.parse(event.registrationEnd))) return false;
  if (event.registrationStart && new Date(event.registrationStart) > now) return false;
  if (event.registrationEnd && new Date(event.registrationEnd) < now) return false;
  return true;
}

export const BLOCKING_REGISTRATION_STATUSES = ["pending", "confirmed", "checked_in"] as const;

export function isDuplicateRegistration(existing: { status: string }[] | null | undefined): boolean {
  if (!existing) return false;
  return existing.some((r) =>
    (BLOCKING_REGISTRATION_STATUSES as readonly string[]).includes(r.status),
  );
}

export function formatMoney(amount: number, currency = "CHF"): string {
  return `${currency} ${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)}`;
}

export function formatMembershipBenefit(price: PriceResult, czech: boolean): string {
  switch (price.benefitType) {
    case "free": return czech ? "V ceně členství" : "Included with membership";
    case "workshop_credit": return czech ? `Kredit na workshop −CHF ${price.benefitValue}` : `Workshop credit −CHF ${price.benefitValue}`;
    case "percent_discount": return czech ? `Členská sleva ${price.benefitValue} %` : `Membership discount ${price.benefitValue}%`;
    case "member_price": return czech ? "Zvýhodněná členská cena" : "Member ticket price";
    default: return czech ? "Veřejná cena" : "Public price";
  }
}
