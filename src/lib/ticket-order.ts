import type { PriceResult } from "./pricing";

/** Trusted server quote input, never prices supplied by a checkout request. */
export type TicketOrderLine = {
  ticketId: string;
  quantity: number;
  price: PriceResult;
};

export type MemberDiscountScope = "one" | "all";

const supportedCurrencies = new Set(["CHF", "EUR", "USD", "GBP", "CZK"]);

/** Build a Stripe inline-price line from the server-calculated order snapshot. */
export function createTicketPriceDataLineItem(input: {
  ticketName: string;
  unitAmountMinor: number;
  currency: string;
  quantity: number;
}) {
  const ticketName = input.ticketName.trim();
  const currency = input.currency.toUpperCase();
  if (!ticketName) throw new Error("Ticket name is unavailable.");
  if (!Number.isSafeInteger(input.unitAmountMinor) || input.unitAmountMinor < 1) {
    throw new Error("Invalid ticket price.");
  }
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1 || input.quantity > 10) {
    throw new Error("Invalid ticket quantity.");
  }
  if (!supportedCurrencies.has(currency)) throw new Error("Unsupported ticket currency.");
  return {
    price_data: {
      currency: currency.toLowerCase(),
      unit_amount: input.unitAmountMinor,
      product_data: { name: ticketName },
    },
    quantity: input.quantity,
  };
}

/** Convert Supabase order-item snapshots into Checkout lines and reconcile the saved total. */
export function createTicketCheckoutLineItems(
  items: Array<{ ticket_name: string; unit_amount_minor: number | string; currency: string; quantity: number }>,
  expectedAmountMinor: number,
  expectedCurrency: string,
) {
  const currency = expectedCurrency.toUpperCase();
  if (!supportedCurrencies.has(currency)) throw new Error("Unsupported ticket currency.");
  if (!Number.isSafeInteger(expectedAmountMinor) || expectedAmountMinor < 0 || !items.length) {
    throw new Error("Order price details are invalid.");
  }
  const savedLines = items.map((item) => {
    const unitAmountMinor = Number(item.unit_amount_minor);
    if (!Number.isSafeInteger(unitAmountMinor) || unitAmountMinor < 0
      || item.currency.toUpperCase() !== currency
      || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) {
      throw new Error("Order price details are invalid.");
    }
    return { ticketName: item.ticket_name, unitAmountMinor, quantity: item.quantity };
  });
  const savedTotal = savedLines.reduce((sum, line) => sum + line.unitAmountMinor * line.quantity, 0);
  if (!Number.isSafeInteger(savedTotal) || savedTotal !== expectedAmountMinor) {
    throw new Error("Order total does not match its saved ticket prices.");
  }
  return savedLines.filter((line) => line.unitAmountMinor > 0).map((line) => createTicketPriceDataLineItem({
    ...line, currency,
  }));
}

/** Integer minor units for supported two-decimal ticket currencies. No business-rule default. */
export function quoteTicketOrder(
  lines: TicketOrderLine[],
  policy: { scope?: MemberDiscountScope; memberTicketId?: string } = {},
) {
  if (!lines.length) throw new Error("Choose at least one ticket.");
  const ids = new Set<string>();
  let quantity = 0;
  let total = 0;
  let regularTotal = 0;
  const currency = lines[0]!.price.currency.toUpperCase();
  for (const line of lines) {
    if (!line.ticketId || ids.has(line.ticketId)) throw new Error("Duplicate or missing ticket type.");
    ids.add(line.ticketId);
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) throw new Error("Invalid ticket quantity.");
    if (!line.price.eligible) throw new Error("This ticket requires an eligible membership.");
    if (!supportedCurrencies.has(line.price.currency.toUpperCase())) throw new Error("Unsupported ticket currency.");
    if (line.price.currency.toUpperCase() !== currency) throw new Error("Ticket types in one order must use the same currency.");
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
  return { currency, quantity, amount: total, discount: regularTotal - total, lines: quotedLines };
}
