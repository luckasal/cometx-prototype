export type TicketAvailability =
  | "available"
  | "preview"
  | "event_closed"
  | "sold_out"
  | "sale_not_started"
  | "sale_ended"
  | "membership_required";

export function ticketAvailability(input: {
  isPreview?: boolean;
  registrationOpen: boolean;
  soldOut: boolean;
  saleStart: string | null;
  saleEnd: string | null;
  eligible: boolean;
}, now = new Date()): TicketAvailability {
  if (input.isPreview) return "preview";
  if (!input.registrationOpen) return "event_closed";
  if (input.soldOut) return "sold_out";
  if (input.saleStart && Date.parse(input.saleStart) > now.getTime()) return "sale_not_started";
  if (input.saleEnd && Date.parse(input.saleEnd) <= now.getTime()) return "sale_ended";
  if (!input.eligible) return "membership_required";
  return "available";
}

export function ticketAvailabilityMessage(
  state: TicketAvailability,
  saleStart: string | null,
  czech: boolean,
): string | null {
  switch (state) {
    case "available": return null;
    case "preview": return czech ? "Nákup není v náhledu dostupný." : "Purchases are disabled in preview.";
    case "event_closed": return czech ? "Prodej vstupenek na tuto akci není otevřen." : "Ticket sales for this event are not open.";
    case "sold_out": return czech ? "Vyprodáno" : "Sold out";
    case "sale_not_started": {
      const date = saleStart ? new Date(saleStart).toLocaleString(czech ? "cs-CZ" : "en-GB", {
        dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zurich",
      }) : "";
      return czech ? `Prodej začíná ${date} (čas ve Švýcarsku).` : `Sales open ${date} (Swiss time).`;
    }
    case "sale_ended": return czech ? "Prodej této vstupenky skončil." : "Sales for this ticket have ended.";
    case "membership_required": return czech ? "Tato vstupenka vyžaduje příslušné členství." : "This ticket requires an eligible membership.";
  }
}

/** Keep the option a visitor can purchase now above future or unavailable tiers. */
export function orderTicketsByAvailability<T>(tickets: T[], getState: (ticket: T) => TicketAvailability): T[] {
  const rank: Record<TicketAvailability, number> = {
    available: 0,
    sale_not_started: 1,
    membership_required: 2,
    sold_out: 3,
    sale_ended: 4,
    event_closed: 5,
    preview: 5,
  };
  return tickets.map((ticket, index) => ({ ticket, index }))
    .sort((a, b) => rank[getState(a.ticket)] - rank[getState(b.ticket)] || a.index - b.index)
    .map(({ ticket }) => ticket);
}
