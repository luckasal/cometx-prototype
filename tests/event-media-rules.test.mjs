import test from "node:test";
import assert from "node:assert/strict";
import { eventImageIssue, eventMediaMaxBytes } from "../src/lib/event-media-rules.ts";

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
