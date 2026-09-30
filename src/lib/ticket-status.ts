/** Checkout holds are not owned tickets, even when a payment is in progress. */
export const OWNED_ORDER_STATUSES = ["confirmed", "free"] as const;
export const CHECKOUT_PENDING_STATUSES = ["draft", "checkout_pending", "payment_pending", "pending", "processing"] as const;
export const ISSUED_TICKET_STATUSES = ["valid", "checked_in"] as const;

export function isOwnedOrderStatus(status: string): boolean {
  return (OWNED_ORDER_STATUSES as readonly string[]).includes(status);
}

export function isCheckoutPendingStatus(status: string): boolean {
  return (CHECKOUT_PENDING_STATUSES as readonly string[]).includes(status);
}

export function isIssuedTicketStatus(status: string): boolean {
  return (ISSUED_TICKET_STATUSES as readonly string[]).includes(status);
}

export function hasIssuedTickets(tickets: readonly { status: string }[] | null | undefined): boolean {
  return tickets?.some((ticket) => isIssuedTicketStatus(ticket.status)) ?? false;
}

export function isOwnedOrderLine(orderStatus: string, tickets: readonly { status: string }[] | null | undefined): boolean {
  return isOwnedOrderStatus(orderStatus) && hasIssuedTickets(tickets);
}

export function isUpcomingEvent(startDate: string, now: Date = new Date()): boolean {
  const startsAt = Date.parse(startDate);
  return Number.isFinite(startsAt) && startsAt >= now.getTime();
}
