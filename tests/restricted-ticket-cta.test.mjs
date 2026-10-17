import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("a restricted ticket gives one membership/sign-in path and cannot be added to cart", async () => {
  const page = await readFile("src/components/site/EventDetailTemplate.tsx", "utf8");
  assert.match(page, /availability === "membership_required" && \(/);
  assert.match(page, /<Link to="\/membership"/);
  assert.match(page, /Already a member\? Log in/);
  assert.match(page, /ticket\.hasMemberPricing && availability !== "membership_required"/);
  assert.match(page, /disabled=\{quantity < 1 \|\| availability !== "available" \|\| maxQuantity < 1\}/);
});
