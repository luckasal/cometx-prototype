/**
 * Pure, testable pricing + eligibility logic.
 * No database access here - callers load the data and pass it in.
 * The client never computes a price it can pay with; see events.functions.ts.
 */

export type EntitlementMap = Record<string, number | null>;

export type TicketPricingInput = {
  basePrice: number;
  currency: string;
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
    };
  }

  if (ticket.discountEntitlement && hasEntitlementIn(entitlements, ticket.discountEntitlement)) {
    const pct = entitlementValueIn(entitlements, ticket.discountEntitlement) ?? 0;
    if (!Number.isFinite(pct)) throw new Error("Invalid membership discount.");
    const clamped = Math.min(Math.max(pct, 0), 100);
    const discount = round2((basePrice * clamped) / 100);
    if (discount > 0) {
      return {
        ...base,
        discount,
        finalPrice: round2(basePrice - discount),
        reason: `Member price (${clamped}% off)`,
      };
    }
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
