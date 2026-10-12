import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

test("member admin mutations require an authenticated administrator and preserve account history", async () => {
  const server = await readFile("src/lib/admin.functions.ts", "utf8");
  const page = await readFile("src/routes/admin.members.tsx", "utf8");
  const grant = server.slice(
    server.indexOf("export const adminGrantMemberAdmin"),
    server.indexOf("export const adminDeleteMemberAccount"),
  );
  const remove = server.slice(
    server.indexOf("export const adminDeleteMemberAccount"),
    server.indexOf("export const adminListPartners"),
  );

  assert.match(grant, /requireAdmin\(\)/);
  assert.match(grant, /from\("user_roles"\)\.insert\(\{ user_id: data\.id, role: "admin" \}\)/);
  assert.match(remove, /requireAdmin\(\)/);
  assert.match(remove, /data\.id === actor\.userId/);
  assert.match(remove, /if \(adminRole\)/);
  for (const table of [
    'from("memberships")',
    'from("membership_applications")',
    'from("registrations")',
    'from("ticket_orders")',
    'from("ticket_attendees")',
    'from("ticket_checkout_batches")',
    'from("payments")',
  ]) {
    assert.ok(remove.includes(table), `deletion history guard should check ${table}`);
  }
  assert.match(remove, /authAdmin\.deleteUser\(data\.id\)/);
  assert.match(page, /window\.confirm\(\s*`Grant full Back Office administrator access/s);
  assert.match(page, /window\.confirm\(\s*`Permanently delete the account/s);
  assert.match(page, /selected\.isAdmin/);
});

test("table displays role names while role management stays inside the details dialog", async () => {
  const page = await readFile("src/routes/admin.members.tsx", "utf8");
  const table = page.slice(page.indexOf("<AdminTable"), page.indexOf("</AdminTable>"));
  assert.doesNotMatch(table, /Assign admin role|Unassign admin role|grant\.mutate/);
  assert.match(table, /<StatusPill tone="signal">Admin<\/StatusPill>/);
  assert.match(table, /View details/);
  assert.match(page, /<DialogContent/);
  const dialog = page.slice(page.indexOf("<DialogContent"));
  assert.match(dialog, /Assign admin role/);
  assert.match(dialog, /Unassign admin role/);
  assert.match(dialog, /selected\.id === user\?\.id/);
});

test("unassigning admin is authorized, scoped to the admin role, and prevents self removal", async () => {
  const server = await readFile("src/lib/admin.functions.ts", "utf8");
  const revoke = server.slice(
    server.indexOf("export const adminRevokeMemberAdmin"),
    server.indexOf("export const adminDeleteMemberAccount"),
  );
  assert.match(revoke, /requireAdmin\(\)/);
  assert.match(revoke, /memberRoleSchema\.parse\(input\)/);
  assert.match(revoke, /data\.id === actor\.userId/);
  assert.match(
    revoke,
    /\.from\("user_roles"\)\s*\.delete\(\)\s*\.eq\("user_id", data\.id\)\s*\.eq\("role", "admin"\)/,
  );
  assert.doesNotMatch(revoke, /deleteUser|from\("profiles"\)|from\("payments"\)/);
});

test("unassign handler blocks unauthorized/self requests and deletes only the target admin role", async () => {
  const server = await readFile("src/lib/admin.functions.ts", "utf8");
  const source = server
    .slice(
      server.indexOf("export const adminRevokeMemberAdmin"),
      server.indexOf("export const adminDeleteMemberAccount"),
    )
    .replace("export const", "const")
    .replace('(await import("./auth.server"))', "auth")
    .replace('await import("@/integrations/supabase/client.server")', "clients");
  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const calls = [];
  let actor = "actor";
  let dbError = null;
  const db = {
    from(table) {
      calls.push(["from", table]);
      return {
        delete() {
          calls.push(["delete"]);
          return {
            eq(column, value) {
              calls.push(["eq", column, value]);
              return {
                async eq(column, value) {
                  calls.push(["eq", column, value]);
                  return { error: dbError };
                },
              };
            },
          };
        },
      };
    },
  };
  const handler = new Function(
    "createServerFn",
    "memberRoleSchema",
    "auth",
    "clients",
    `${js}; return adminRevokeMemberAdmin;`,
  )(
    () => ({ validator: () => ({ handler: (handler) => handler }) }),
    { parse: (input) => input },
    {
      requireAdmin: async () => {
        if (!actor) throw new Error("Admin access required.");
        return { userId: actor };
      },
    },
    { supabaseAdmin: db },
  );
  actor = null;
  await assert.rejects(handler({ data: { id: "target" } }), /Admin access required/);
  assert.deepEqual(calls, []);
  actor = "actor";
  await assert.rejects(handler({ data: { id: "actor" } }), /own administrator access/);
  assert.deepEqual(calls, []);
  assert.deepEqual(await handler({ data: { id: "target" } }), { ok: true });
  assert.deepEqual(calls, [
    ["from", "user_roles"],
    ["delete"],
    ["eq", "user_id", "target"],
    ["eq", "role", "admin"],
  ]);
  dbError = { message: "internal database error" };
  await assert.rejects(
    handler({ data: { id: "target" } }),
    /Administrator access could not be removed/,
  );
});
