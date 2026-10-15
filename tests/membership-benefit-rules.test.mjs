import test from "node:test";
import assert from "node:assert/strict";
import { membershipBenefitValueIssue } from "../src/lib/membership-benefit-rules.ts";

test("percentage benefits accept only supported 0–100 values", () => {
  assert.equal(membershipBenefitValueIssue("other_events_discount", "cometxxl", 50), null);
  assert.equal(membershipBenefitValueIssue("other_events_discount", "cometxxl", 0), null);
  assert.match(membershipBenefitValueIssue("other_events_discount", "cometxxl", 101), /0 to 100/);
  assert.match(membershipBenefitValueIssue("other_events_discount", "cometxxl", null), /0 to 100/);
});

test("fixed workshop credits stay aligned with checkout pricing by plan", () => {
  assert.equal(membershipBenefitValueIssue("workshop_credit", "cometxxl", 100), null);
  assert.equal(membershipBenefitValueIssue("workshop_credit", "ambasador", 300), null);
  assert.match(
    membershipBenefitValueIssue("workshop_credit", "ambasador", 100),
    /CHF 100.*CHF 300/,
  );
  assert.match(membershipBenefitValueIssue("workshop_credit", "fanousek", 100), /only as/);
});

test("included and custom access benefits cannot masquerade as a price discount", () => {
  assert.equal(membershipBenefitValueIssue("community_membership", "fanousek", 1), null);
  assert.match(membershipBenefitValueIssue("community_membership", "fanousek", 15), /value 1/);
  assert.equal(membershipBenefitValueIssue("partner_network", "cometxxl", 1), null);
  assert.match(membershipBenefitValueIssue("partner_network", "cometxxl", 10), /Access-only/);
});
