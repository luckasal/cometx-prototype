export type TicketCartLine = { eventSlug: string; ticketId: string; quantity: number };

const CART_KEY = "cometx-ticket-cart-v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function readTicketCart(): TicketCartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(CART_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter((line): line is TicketCartLine =>
      typeof line === "object" && line !== null &&
      typeof line.eventSlug === "string" && SLUG.test(line.eventSlug) &&
      typeof line.ticketId === "string" && UUID.test(line.ticketId) &&
      Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 10,
    );
  } catch {
    return [];
  }
}

export function writeTicketCart(lines: TicketCartLine[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_KEY, JSON.stringify(lines));
  window.dispatchEvent(new Event("cometx-ticket-cart-change"));
}

export function addTicketToCart(eventSlug: string, ticketId: string, quantity: number): void {
  if (!SLUG.test(eventSlug) || !UUID.test(ticketId) || !Number.isInteger(quantity) || quantity < 1) return;
  const lines = readTicketCart();
  const existing = lines.find((line) => line.eventSlug === eventSlug && line.ticketId === ticketId);
  const otherEventTotal = lines.filter((line) => line.eventSlug === eventSlug && line.ticketId !== ticketId).reduce((sum, line) => sum + line.quantity, 0);
  const allowed = Math.min(quantity, 10 - otherEventTotal);
  if (allowed < 1) return;
  const next = existing
    ? lines.map((line) => line === existing ? { ...line, quantity: Math.min(10 - otherEventTotal, line.quantity + allowed) } : line)
    : [...lines, { eventSlug, ticketId, quantity: allowed }];
  writeTicketCart(next);
}

export function ticketCartCount(lines: TicketCartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function ticketCartCountLabel(count: number, cs: boolean): string {
  if (!cs) return `${count} ${count === 1 ? "ticket" : "tickets"}`;
  const hundred = count % 100;
  const unit = count % 10;
  const noun = hundred >= 12 && hundred <= 14 ? "vstupenek" : unit === 1 ? "vstupenka" : unit >= 2 && unit <= 4 ? "vstupenky" : "vstupenek";
  return `${count} ${noun}`;
}
