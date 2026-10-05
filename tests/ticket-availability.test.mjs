import test from "node:test";
import assert from "node:assert/strict";
import { orderTicketsByAvailability, ticketAvailability, ticketAvailabilityMessage } from "../src/lib/ticket-availability.ts";
import { isRegistrationOpen } from "../src/lib/pricing.ts";

const now = new Date("2026-10-02T12:00:00Z");
const base = { registrationOpen: true, soldOut: false, saleStart: null, saleEnd: null, eligible: true };

test("ticket sale dates explain why a visible option cannot be selected", () => {
  const upcoming = ticketAvailability({ ...base, saleStart: "2026-11-30T14:55:00Z" }, now);
  assert.equal(upcoming, "sale_not_started");
  assert.match(ticketAvailabilityMessage(upcoming, "2026-11-30T14:55:00Z", false), /Sales open 30 Nov 2026, 15:55 \(Swiss time\)/);
  assert.equal(ticketAvailability({ ...base, saleEnd: "2026-09-30T12:00:00Z" }, now), "sale_ended");
  assert.equal(ticketAvailability({ ...base, saleStart: "2026-09-01T12:00:00Z", saleEnd: "2026-11-30T12:00:00Z" }, now), "available");
});

test("event and capacity restrictions take precedence over ticket sale window", () => {
  assert.equal(ticketAvailability({ ...base, registrationOpen: false }, now), "event_closed");
  assert.equal(ticketAvailability({ ...base, soldOut: true }, now), "sold_out");
  assert.equal(ticketAvailability({ ...base, eligible: false }, now), "membership_required");
  assert.equal(ticketAvailability({ ...base, isPreview: true }, now), "preview");
});

test("a past event is closed even if an admin left its status open", () => {
  assert.equal(isRegistrationOpen({ status: "registration_open", startDate: "2026-09-30T12:00:00Z",
    registrationStart: null, registrationEnd: null }, now), false);
  assert.equal(isRegistrationOpen({ status: "registration_open", startDate: "2027-09-30T12:00:00Z",
    registrationStart: null, registrationEnd: null }, now), true);
});

test("the ticket on sale now appears before a regular ticket that opens later", () => {
  const tickets = [
    { id: "regular", saleStart: "2026-11-30T14:55:00Z", saleEnd: null },
    { id: "early", saleStart: null, saleEnd: "2026-11-30T14:55:00Z" },
  ];
  const ordered = orderTicketsByAvailability(tickets, (ticket) =>
    ticketAvailability({ ...base, saleStart: ticket.saleStart, saleEnd: ticket.saleEnd }, now));
  assert.deepEqual(ordered.map((ticket) => ticket.id), ["early", "regular"]);
  assert.deepEqual(tickets.map((ticket) => ticket.id), ["regular", "early"]);
});
