import test from "node:test";
import assert from "node:assert/strict";
import { eventScheduleIssue } from "../src/lib/event-admin.ts";

const valid = {
  start_date: "2027-03-12T13:00:00+01:00",
  end_date: "2027-03-12T19:00:00+01:00",
  registration_start: "2026-09-01T12:00:00+02:00",
  registration_end: "2027-03-10T23:59:00+01:00",
};

test("event editor accepts a valid schedule and optional windows", () => {
  assert.equal(eventScheduleIssue(valid), null);
  assert.equal(eventScheduleIssue({ ...valid, end_date: null, registration_start: null, registration_end: null }), null);
});

test("event editor rejects invalid and reversed dates before saving", () => {
  assert.match(eventScheduleIssue({ ...valid, start_date: "not a date" }), /valid event start/);
  assert.match(eventScheduleIssue({ ...valid, end_date: valid.start_date }), /Event end must follow/);
  assert.match(eventScheduleIssue({ ...valid, registration_end: valid.registration_start }), /Registration end must follow/);
});
