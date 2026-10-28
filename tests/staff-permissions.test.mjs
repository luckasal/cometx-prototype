import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile("src/lib/staff-permissions.ts", "utf8");
const js = ts.transpileModule(source.replaceAll("export ", ""), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const {
  hasStaffPermission: can,
  staffPermissions,
  permissionsForRoles,
  staffRoutePermission,
} = new Function(
  `${js}; return { hasStaffPermission, staffPermissions, permissionsForRoles, staffRoutePermission };`,
)();

test("administrator has all defined permissions but unknown values fail closed", () => {
  for (const permission of staffPermissions) assert.equal(can(["admin"], permission), true);
  for (const roles of [[], ["user"], ["ADMIN"], ["owner"], ["__proto__"]]) {
    assert.deepEqual(permissionsForRoles(roles), []);
  }
  assert.equal(can(["admin"], "unknown.action"), false);
});

test("event manager manages events and check-in but not refunds, contacts or roles", () => {
  for (const permission of ["events.read", "events.write", "attendees.check_in", "orders.read"])
    assert.equal(can(["event_manager"], permission), true);
  for (const permission of [
    "roles.manage",
    "payments.refund",
    "payments.record_manual",
    "payments.manage_invoices",
    "contacts.write",
    "members.write",
    "memberships.write",
  ])
    assert.equal(can(["event_manager"], permission), false);
});

test("analyst is read-only and marketing cannot access financial or role management", () => {
  const analyst = permissionsForRoles(["data_analyst"]);
  assert.ok(analyst.includes("reports.read"));
  assert.ok(analyst.every((permission) => permission.endsWith(".read")));
  for (const permission of [
    "contacts.write",
    "content.write",
    "newsletter.write",
    "partners.write",
  ])
    assert.equal(can(["marketing"], permission), true);
  for (const permission of [
    "events.write",
    "orders.read",
    "payments.read",
    "payments.refund",
    "payments.record_manual",
    "payments.manage_invoices",
    "roles.manage",
  ])
    assert.equal(can(["marketing"], permission), false);
});

test("combined roles merge capabilities without granting unrelated privileges", () => {
  assert.equal(can(["marketing", "event_manager"], "events.write"), true);
  assert.equal(can(["marketing", "event_manager"], "contacts.write"), true);
  assert.equal(can(["marketing", "event_manager"], "roles.manage"), false);
  assert.equal(can(["marketing", "event_manager"], "payments.refund"), false);
});

test("route permissions identify editors and reject unmapped/private lookalikes", () => {
  assert.equal(staffRoutePermission("/admin/events"), "events.read");
  assert.equal(staffRoutePermission("/admin/events/new"), "events.write");
  assert.equal(staffRoutePermission("/admin/articles/record"), "content.write");
  for (const path of ["/account", "/admin/unknown", "/admin/__proto__"])
    assert.equal(staffRoutePermission(path), null);
});

test("server permission guard authenticates, scopes role reads and fails closed", async () => {
  const server = await readFile("src/lib/auth.server.ts", "utf8");
  const guard = server.slice(server.indexOf("export async function requireStaffPermission"));
  const compiled = ts.transpileModule(guard.replaceAll("export ", ""), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let signedIn = true;
  let roles = ["marketing"];
  let error = null;
  let readId;
  const handler = new Function(
    "requireUser",
    "getReadClient",
    "hasStaffPermission",
    `${compiled}; return requireStaffPermission;`,
  )(
    async () => {
      if (!signedIn) throw new Error("Sign in required");
      return { userId: "caller" };
    },
    () => ({
      from: (table) => {
        assert.equal(table, "user_roles");
        return {
          select: () => ({
            eq: async (column, id) => {
              assert.equal(column, "user_id");
              readId = id;
              return { data: roles.map((role) => ({ role })), error };
            },
          }),
        };
      },
    }),
    can,
  );
  assert.deepEqual(await handler("contacts.write"), {
    userId: "caller",
    staffRoles: ["marketing"],
  });
  assert.equal(readId, "caller");
  await assert.rejects(handler("roles.manage"), /permission/);
  roles = ["admin"];
  assert.deepEqual(await handler("roles.manage"), { userId: "caller", staffRoles: ["admin"] });
  error = { message: "private database failure" };
  await assert.rejects(handler("roles.manage"), /verify your access/);
  error = null;
  signedIn = false;
  await assert.rejects(handler("contacts.read"), /Sign in required/);
});
