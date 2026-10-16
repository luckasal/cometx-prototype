import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile("src/lib/membership.functions.ts", "utf8");
const section = source.slice(
  source.indexOf("export type WorkshopCreditStatus"),
  source.indexOf("export const getAccountOverview"),
);

function makeHandler({ planSlug = "cometxxl", benefit = 100, orders = [], queryError = null } = {}) {
  const calls = [];
  const query = {
    select(value) { calls.push(["select", value]); return this; },
    eq(key, value) { calls.push(["eq", key, value]); return this; },
    gte(key, value) { calls.push(["gte", key, value]); return this; },
    then(resolve) { return Promise.resolve({ data: orders, error: queryError }).then(resolve); },
  };
  const mocks = {
    auth: { requireUser: async () => ({ userId: "signed-in-user" }) },
    membership: {
      getCurrentMembership: async (id) => {
        calls.push(["membership", id]);
        return { startsAt: "2026-10-08T00:00:00Z", plan: { id: "plan-id", slug: planSlug } };
      },
      getPlanEntitlements: async () => ({ workshop_credit: benefit }),
    },
    database: { assertDatabaseResult: ({ error }) => { if (error) throw error; } },
    client: {
      supabaseAdmin: { from: (table) => { calls.push(["from", table]); return query; } },
    },
    classifier: { workshopCreditState: (rows) => rows.some((row) => row.status === "confirmed") ? "used" : rows.some((row) => row.status === "pending") ? "reserved" : "available" },
  };
  const js = ts.transpileModule(
    section
      .replace("export type WorkshopCreditStatus", "type WorkshopCreditStatus")
      .replace("export const getMyWorkshopCreditStatus", "const getMyWorkshopCreditStatus")
      .replace('await import("./auth.server")', "mocks.auth")
      .replace('await import("./membership.server")', "mocks.membership")
      .replace('await import("./database.server")', "mocks.database")
      .replace('await import("@/integrations/supabase/client.server")', "mocks.client")
      .replace('await import("./workshop-credit-status")', "mocks.classifier"),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
  ).outputText;
  const handler = new Function("createServerFn", "mocks", `${js}; return getMyWorkshopCreditStatus;`)(
    () => ({ handler: (fn) => fn }), mocks,
  );
  return { handler, calls };
}

test("workshop credit distinguishes completed use and pending reservation", async () => {
  const available = makeHandler();
  assert.deepEqual(await available.handler(), { amount: 100, state: "available" });
  assert.deepEqual(available.calls.slice(1), [
    ["from", "ticket_orders"],
    ["select", "status,expires_at,ticket_order_items!inner(benefit_type)"],
    ["eq", "user_id", "signed-in-user"],
    ["gte", "created_at", "2026-10-08T00:00:00Z"],
    ["eq", "ticket_order_items.benefit_type", "workshop_credit"],
  ]);
  const used = makeHandler({ planSlug: "ambasador", benefit: 300, orders: [{ status: "confirmed" }] });
  assert.deepEqual(await used.handler(), { amount: 300, state: "used" });
  const reserved = makeHandler({ orders: [{ status: "pending" }] });
  assert.deepEqual(await reserved.handler(), { amount: 100, state: "reserved" });
});

test("workshop credit does not advertise an unassigned benefit or hide a database error", async () => {
  const notAssigned = makeHandler({ benefit: null });
  assert.equal(await notAssigned.handler(), null);
  assert.equal(notAssigned.calls.some(([kind]) => kind === "from"), false);
  await assert.rejects(makeHandler({ queryError: new Error("lookup failed") }).handler(), /lookup failed/);
});
