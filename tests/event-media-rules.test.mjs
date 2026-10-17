import test from "node:test";
import assert from "node:assert/strict";
import { eventImageIssue, eventMediaMaxBytes, managedEventMediaPath } from "../src/lib/event-media-rules.ts";

test("event media accepts supported photos up to 5 MB", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    assert.equal(eventImageIssue({ type, size: eventMediaMaxBytes }), null);
  }
});

test("event media rejects empty, oversized and unsupported files", () => {
  assert.match(eventImageIssue({ type: "image/png", size: 0 }), /between 1 byte and 5 MB/);
  assert.match(eventImageIssue({ type: "image/png", size: eventMediaMaxBytes + 1 }), /between 1 byte and 5 MB/);
  assert.match(eventImageIssue({ type: "image/svg+xml", size: 100 }), /JPEG, PNG or WebP/);
});

test("unused-photo cleanup accepts only generated files in the event-media scopes", () => {
  const file = "550e8400-e29b-41d4-a716-446655440000";
  for (const scope of ["event-heroes", "event-gallery", "speaker-photos"]) {
    assert.equal(managedEventMediaPath.test(`${scope}/${file}.webp`), true);
  }
  for (const path of [
    `other/${file}.jpg`,
    `event-heroes/../../${file}.jpg`,
    `event-heroes/${file}.svg`,
    "event-gallery/manual-photo.jpg",
    `event-heroes/${file}.jpg/another`,
  ]) {
    assert.equal(managedEventMediaPath.test(path), false, path);
  }
});
