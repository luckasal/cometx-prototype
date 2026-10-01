const checkInOrderStatuses = new Set(["confirmed", "free"]);

/** Only issued tickets from fulfilled orders can be checked in. */
export function canCheckInEventTicket(attendeeStatus: string, orderStatus: string): boolean {
  return attendeeStatus === "valid" && checkInOrderStatuses.has(orderStatus);
}

/** Prevent spreadsheet formulas from executing when staff export attendee data. */
export function csvCell(value: unknown): string {
  const text = String(value ?? "");
  const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
