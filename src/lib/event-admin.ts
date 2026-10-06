export type EventLifecycleFields = {
  publish_state: string;
  event_status: string;
};

export type EventLifecycleStatus = "draft" | "published" | "unpublished" | "completed" | "cancelled";

/** Completed and cancelled describe the event lifecycle; publication remains a separate field. */
export function getEventLifecycleStatus(event: EventLifecycleFields): EventLifecycleStatus {
  if (event.event_status === "completed" || event.event_status === "cancelled") return event.event_status;
  if (event.publish_state === "published" || event.publish_state === "unpublished") return event.publish_state;
  return "draft";
}

export function formatEventLifecycleStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** The first scheduled ticket phase opens event registration. Undated tickets inherit that window. */
export function earliestTicketSaleStart<T extends { sale_start: string | null }>(tickets: T[]): T | null {
  return tickets.reduce<T | null>((earliest, ticket) => {
    if (!ticket.sale_start || !Number.isFinite(Date.parse(ticket.sale_start))) return earliest;
    if (!earliest?.sale_start || Date.parse(ticket.sale_start) < Date.parse(earliest.sale_start)) return ticket;
    return earliest;
  }, null);
}

/** Validate date ordering before an event can be saved or published. */
export function eventScheduleIssue(input: {
  start_date: string;
  end_date: string | null;
  registration_start: string | null;
  registration_end: string | null;
}): string | null {
  const start = Date.parse(input.start_date);
  if (!Number.isFinite(start)) return "Enter a valid event start date and time.";
  const end = input.end_date ? Date.parse(input.end_date) : null;
  if (end !== null && !Number.isFinite(end)) return "Enter a valid event end date and time.";
  if (end !== null && end <= start) return "Event end must follow event start.";
  const registrationStart = input.registration_start ? Date.parse(input.registration_start) : null;
  const registrationEnd = input.registration_end ? Date.parse(input.registration_end) : null;
  if (registrationStart !== null && !Number.isFinite(registrationStart)) return "Enter a valid registration start date and time.";
  if (registrationEnd !== null && !Number.isFinite(registrationEnd)) return "Enter a valid registration end date and time.";
  if (registrationStart !== null && registrationEnd !== null && registrationEnd <= registrationStart) {
    return "Registration end must follow registration start.";
  }
  return null;
}
