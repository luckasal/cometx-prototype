import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

test("every staff-accessible handler declares the correct read/write capability", async () => {
  const source = await readFile("src/lib/admin.functions.ts", "utf8");
  const expected = {
    adminListEvents: "events.read",
    adminGetEvent: "events.read",
    adminSaveEvent: "events.write",
    adminDeleteEvent: "events.write",
    adminSetEventPublishState: "events.write",
    adminSyncPublishedTicketCatalog: "events.write",
    adminListSpeakers: "events.read",
    adminSaveSpeaker: "events.write",
    adminDeleteSpeaker: "events.write",
    adminListWorkshops: "events.read",
    adminListEntitlements: "entitlements.read",
    adminListMembers: "members.read",
    adminListRegistrations: "attendees.read",
    adminListEventAttendees: "attendees.read",
    adminListTicketOrders: "orders.read",
    adminListContacts: "contacts.read",
    adminSaveContact: "contacts.write",
    adminListMemberOptions: "contacts.read",
    adminListArticles: "content.read",
    adminGetArticle: "content.read",
    adminSaveArticle: "content.write",
    adminDeleteArticle: "content.write",
    adminListContent: "content.read",
    adminSaveContent: "content.write",
    adminDeleteContent: "content.write",
    adminListPartners: "partners.read",
    adminSavePartner: "partners.write",
    adminDeletePartner: "partners.write",
    adminListPlans: "memberships.read",
    adminSavePlan: "memberships.write",
    adminSyncMembershipCatalog: "memberships.write",
    adminListPayments: "payments.read",
    getAdminIntegrationStatus: "settings.manage",
  };
  const ast = ts.createSourceFile("admin.functions.ts", source, ts.ScriptTarget.Latest, true);
  const handlers = new Map();
  for (const statement of ast.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations)
      handlers.set(declaration.name.getText(ast), declaration.getText(ast));
  }
  for (const [name, permission] of Object.entries(expected))
    assert.ok(
      handlers.get(name)?.includes(`await admin("${permission}")`),
      `${name} must require ${permission}`,
    );
  assert.match(source, /await requireStaffPermission\(permission\)/);
  assert.ok(
    source.indexOf("await requireStaffPermission(permission)") <
      source.indexOf('import("@/integrations/supabase/client.server")'),
  );
  assert.match(
    handlers.get("adminCheckInEventAttendee"),
    /requireStaffPermission\("attendees.check_in"\)/,
  );
  for (const name of [
    "adminGrantMemberAdmin",
    "adminRevokeMemberAdmin",
    "adminDeleteMemberAccount",
  ])
    assert.match(handlers.get(name), /requireAdmin\(\)/);
});

test("staff assignment is full-admin-only, self-protected, validated, idempotent and role-scoped", async () => {
  const source = await readFile("src/lib/staff-roles.functions.ts", "utf8");
  assert.match(source, /z.enum\(\["event_manager", "data_analyst", "marketing"\]\)/);
  const js = ts.transpileModule(
    source
      .replace(/^import .*;\r?\n/gm, "")
      .replace("export const", "const")
      .replace('await (await import("./auth.server")).requireAdmin()', "await requireAdmin()")
      .replace('await import("@/integrations/supabase/client.server")', "clients"),
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  let actor = "admin";
  let error = null;
  const writes = [];
  const db = {
    from: (table) => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { id: "target" }, error: null }) }),
      }),
      insert: async (payload) => {
        writes.push({ table, payload });
        return { error };
      },
      delete: () => ({
        eq: (key, id) => ({
          eq: async (roleKey, role) => {
            writes.push({ table, key, id, roleKey, role });
            return { error };
          },
        }),
      }),
    }),
  };
  const handler = new Function(
    "z",
    "createServerFn",
    "requireAdmin",
    "clients",
    `${js};return adminChangeStaffRole;`,
  )(
    {
      object: () => ({}),
      string: () => ({ uuid: () => ({}) }),
      enum: () => ({}),
      boolean: () => ({}),
    },
    () => ({ validator: () => ({ handler: (handler) => handler }) }),
    async () => {
      if (!actor) throw new Error("Admin required");
      return { userId: actor };
    },
    { supabaseAdmin: db },
  );
  actor = null;
  await assert.rejects(
    handler({ data: { id: "target", role: "marketing", assigned: true } }),
    /Admin required/,
  );
  assert.equal(writes.length, 0);
  actor = "admin";
  await assert.rejects(
    handler({ data: { id: "admin", role: "marketing", assigned: true } }),
    /own staff roles/,
  );
  assert.equal(writes.length, 0);
  assert.deepEqual(await handler({ data: { id: "target", role: "marketing", assigned: true } }), {
    ok: true,
  });
  assert.deepEqual(writes[0], {
    table: "user_roles",
    payload: { user_id: "target", role: "marketing" },
  });
  await handler({ data: { id: "target", role: "marketing", assigned: false } });
  assert.deepEqual(writes[1], {
    table: "user_roles",
    key: "user_id",
    id: "target",
    roleKey: "role",
    role: "marketing",
  });
  error = { code: "23505" };
  await handler({ data: { id: "target", role: "marketing", assigned: true } });
  error = { code: "22P02" };
  await assert.rejects(
    handler({ data: { id: "target", role: "marketing", assigned: true } }),
    /database setup/,
  );
});

test("restricted pages omit mutation forms and unknown routes fail closed", async () => {
  const layout = await readFile("src/routes/admin.tsx", "utf8");
  assert.match(layout, /visibleNav = nav.filter/);
  assert.match(layout, /!canVisit\(pathname\)/);
  assert.match(layout, /readOnly \? \(/);
  assert.match(layout, /<StaffReadOnly pathname=\{pathname\}/);
  const readOnly = await readFile("src/components/admin/StaffReadOnly.tsx", "utf8");
  assert.doesNotMatch(readOnly, /useMutation|<form|adminSave|adminDelete/);
  assert.match(readOnly, /Export CSV/);
  assert.match(
    await readFile("src/lib/admin-analytics.functions.ts", "utf8"),
    /requireStaffPermission\("reports.read"\)/,
  );
  assert.match(
    await readFile("src/lib/event-orders.functions.ts", "utf8"),
    /requireStaffPermission\("orders.read"\)/,
  );
});

test("migration adds role labels without weakening RLS, grants or administrator checks", async () => {
  const sql = await readFile(
    "supabase/migrations/20261012173752_restricted_staff_roles.sql",
    "utf8",
  );
  for (const role of ["event_manager", "data_analyst", "marketing"])
    assert.ok(sql.includes(`add value if not exists '${role}'`));
  assert.doesNotMatch(sql, /create policy|disable row level|grant |create.*function/i);
});
