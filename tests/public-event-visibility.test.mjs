import assert from "node:assert/strict";
import test from "node:test";
import { isPublicEventListingCandidate } from "../src/lib/public-event-visibility.ts";

test("known internal demo event is omitted from public discovery", () => {
  assert.equal(isPublicEventListingCandidate({ slug: "new-demo-event" }), false);
  assert.equal(isPublicEventListingCandidate({ slug: "annual-symposium-2026" }), true);
  assert.equal(isPublicEventListingCandidate({ slug: "science-demo-night" }), true);
});
