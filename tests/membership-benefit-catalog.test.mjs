import assert from "node:assert/strict";
import test from "node:test";
import { benefitKind, formatMembershipBenefit } from "../src/lib/membership-benefit-catalog.ts";

test("benefit catalogue distinguishes checkout-relevant benefit types", () => {
  assert.equal(benefitKind("community_membership"), "access");
  assert.equal(benefitKind("symposium_free_ticket"), "free_ticket");
  assert.equal(benefitKind("other_events_discount"), "percentage");
  assert.equal(benefitKind("workshop_credit"), "credit");
  assert.equal(benefitKind("new_partner_access"), "access");
});

test("public, account and admin benefit copy can use the same value-aware formatter", () => {
  assert.equal(formatMembershipBenefit({ key: "other_events_discount", name: "Other events", value: 50 }), "50% off one other event ticket (except workshops) per event");
  assert.equal(formatMembershipBenefit({ key: "workshop_credit", name: "Workshop credit", value: 100 }), "One-time workshop credit: CHF 100");
  assert.equal(formatMembershipBenefit({ key: "symposium_free_ticket", name: "Symposium free", value: 1 }), "One SCAS Symposium ticket included");
  assert.equal(formatMembershipBenefit({ key: "new_partner_access", name: "Partner benefit", value: 1 }), "Partner benefit");
  assert.equal(formatMembershipBenefit({ key: "other_events_discount", name: "Sleva 50 % na další akce", value: 50 }, "cs"), "Sleva 50 % na další akce · jedna vstupenka na akci");
  assert.equal(formatMembershipBenefit({ key: "symposium_free_ticket", name: "Vstup zdarma na SCAS", value: 1 }, "cs"), "Vstup zdarma na SCAS · jedna vstupenka na akci");
  assert.equal(formatMembershipBenefit({ key: "workshop_credit", name: "Workshopový kupón", value: 300 }, "cs"), "Workshopový kupón: CHF 300 · jednorázově");
});
