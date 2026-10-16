import test from "node:test";
import assert from "node:assert/strict";
import { previewTicketByPlan } from "../src/lib/event-ticket-preview.ts";

const plans = [
  {
    id: "fan",
    name: "Fanoušek",
    slug: "fanousek",
    plan_entitlements: [
      { value: 50, entitlements: { key: "symposium_half_price", name: "Symposium discount" } },
    ],
  },
  {
    id: "xxl",
    name: "CometXXL",
    slug: "cometxxl",
    plan_entitlements: [
      { value: 1, entitlements: { key: "symposium_free_ticket", name: "Symposium admission" } },
      { value: 100, entitlements: { key: "workshop_credit", name: "Workshop credit" } },
    ],
  },
  {
    id: "amb",
    name: "Ambasador",
    slug: "ambasador",
    plan_entitlements: [
      { value: 1, entitlements: { key: "potlach_free_ticket", name: "POTLA.CH admission" } },
      { value: 300, entitlements: { key: "workshop_credit", name: "Workshop credit" } },
    ],
  },
];
const ticket = {
  base_price: "200",
  member_price: "",
  currency: "CHF",
  required_entitlement: "",
  discount_entitlement: "",
  free_entitlement: "",
};

test("editor preview uses active plan assignments and marks required-benefit ineligibility", () => {
  const symposium = previewTicketByPlan(
    { ...ticket, required_entitlement: "symposium_free_ticket" },
    "symposium",
    plans,
  );
  assert.deepEqual(
    symposium.map((row) => [row.name, row.eligible, row.price?.finalPrice ?? null]),
    [
      ["Fanoušek", false, null],
      ["CometXXL", true, 0],
      ["Ambasador", false, null],
    ],
  );
  const open = previewTicketByPlan(ticket, "symposium", plans);
  assert.deepEqual(
    open.map((row) => row.price?.finalPrice),
    [100, 0, 200],
  );
});

test("workshop credit is optional in cart, not presented as the default member price", () => {
  const workshop = previewTicketByPlan({ ...ticket, base_price: "265" }, "workshop", plans);
  assert.deepEqual(
    workshop.map((row) => [row.price?.finalPrice, row.optionalWorkshopCredit]),
    [
      [265, null],
      [265, 100],
      [265, 300],
    ],
  );
  assert.deepEqual(previewTicketByPlan({ ...ticket, base_price: "" }, "workshop", plans), []);
  const creditRequired = previewTicketByPlan(
    { ...ticket, required_entitlement: "workshop_credit" },
    "workshop",
    plans,
  );
  assert.deepEqual(
    creditRequired.map((row) => row.eligible),
    [false, true, true],
  );
});
