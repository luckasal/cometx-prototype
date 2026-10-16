import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile("src/lib/membership.functions.ts", "utf8");
const section = source.slice(
  source.indexOf("export type WorkshopCreditStatus"),
  source.indexOf("export const getAccountOverview"),
);

function makeHandler({ planSlug = "cometxxl", benefit = 100, used = false, rpcError = null } = {}) {
  const calls = [];
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
      supabaseAdmin: {
        rpc: async (name, params) => {
          calls.push(["rpc", name, params]);
          return { data: used, error: rpcError };
        },
      },
    },
  };
  const js = ts.transpileModule(
    section
      .replace("export type WorkshopCreditStatus", "type WorkshopCreditStatus")
      .replace("export const getMyWorkshopCreditStatus", "const getMyWorkshopCreditStatus")
      .replace('await import("./auth.server")', "mocks.auth")
      .replace('await import("./membership.server")', "mocks.membership")
      .replace('await import("./database.server")', "mocks.database")
      .replace('await import("@/integrations/supabase/client.server")', "mocks.client"),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
  ).outputText;
  const handler = new Function("createServerFn", "mocks", `${js}; return getMyWorkshopCreditStatus;`)(
    () => ({ handler: (fn) => fn }), mocks,
  );
  return { handler, calls };
}

test("workshop credit reports availability and used/reserved state for the signed-in member", async () => {
  const available = makeHandler();
  assert.deepEqual(await available.handler(), { amount: 100, state: "available" });
  assert.deepEqual(available.calls[1], ["rpc", "workshop_credit_is_used", {
    p_user_id: "signed-in-user", p_membership_start: "2026-10-08T00:00:00Z",
  }]);
  const used = makeHandler({ planSlug: "ambasador", benefit: 300, used: true });
  assert.deepEqual(await used.handler(), { amount: 300, state: "used_or_reserved" });
});

test("workshop credit does not advertise an unassigned benefit or hide a database error", async () => {
  const notAssigned = makeHandler({ benefit: null });
  assert.equal(await notAssigned.handler(), null);
  assert.equal(notAssigned.calls.some(([kind]) => kind === "rpc"), false);
  await assert.rejects(makeHandler({ rpcError: new Error("lookup failed") }).handler(), /lookup failed/);
});
