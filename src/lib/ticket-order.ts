import type { PriceResult } from "./pricing";

/** Trusted server quote input, never prices supplied by a checkout request. */
export type TicketOrderLine = {
  ticketId: string;
  quantity: number;
  price: PriceResult;
};

export type MemberDiscountScope = "one" | "all";

/** Integer minor units for the current CHF ticket catalogue. No business-rule default. */
export function quoteTicketOrder(
  lines: TicketOrderLine[],
  policy: { scope?: MemberDiscountScope; memberTicketId?: string } = {},
) {
  if (!lines.length) throw new Error("Choose at least one ticket.");
  const ids = new Set<string>();
  let quantity = 0;
  let total = 0;
  let regularTotal = 0;
  for (const line of lines) {
    if (!line.ticketId || ids.has(line.ticketId)) throw new Error("Duplicate or missing ticket type.");
    ids.add(line.ticketId);
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) throw new Error("Invalid ticket quantity.");
    if (!line.price.eligible) throw new Error("This ticket requires an eligible membership.");
    if (line.price.currency.toUpperCase() !== "CHF") throw new Error("Unsupported ticket currency.");
    quantity += line.quantity;
    if (!Number.isSafeInteger(quantity)) throw new Error("Invalid ticket quantity.");
  }
  const discounted = lines.filter((line) => line.price.finalPrice < line.price.basePrice);
  if (quantity > 1 && discounted.length && !policy.scope) {
    throw new Error("CometX must configure how membership pricing applies to additional tickets.");
  }
  if (policy.scope === "one" && discounted.length &&
      !discounted.some((line) => line.ticketId === policy.memberTicketId)) {
    throw new Error("Select which ticket uses the membership benefit.");
  }
  const quotedLines = lines.map((line) => {
    const regularUnit = Math.round(line.price.basePrice * 100);
    const memberUnit = Math.round(line.price.finalPrice * 100);
    if (!Number.isSafeInteger(regularUnit) || !Number.isSafeInteger(memberUnit) ||
        regularUnit < 0 || memberUnit < 0 || memberUnit > regularUnit) {
      throw new Error("Invalid ticket price.");
    }
    const memberQuantity = memberUnit < regularUnit
      ? policy.scope === "all" ? line.quantity
        : policy.scope === "one" ? Number(line.ticketId === policy.memberTicketId)
          : 1
      : 0;
    const regularQuantity = line.quantity - memberQuantity;
    const amount = regularQuantity * regularUnit + memberQuantity * memberUnit;
    total += amount;
    regularTotal += line.quantity * regularUnit;
    if (!Number.isSafeInteger(total) || !Number.isSafeInteger(regularTotal)) {
      throw new Error("Order total is too large.");
    }
    return { ticketId: line.ticketId, quantity: line.quantity, memberQuantity,
      regularQuantity, regularUnit, memberUnit, amount };
  });
  return { currency: "CHF", quantity, amount: total, discount: regularTotal - total, lines: quotedLines };
}
