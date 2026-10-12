import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

async function loadTimeout() {
  const source = await readFile("src/lib/request-timeout.ts", "utf8");
  const js = ts.transpileModule(source.replace("export async", "async"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function(`${js}; return withRequestTimeout;`)();
}

test("bounded requests return success, preserve failures, and time out stalled requests", async () => {
  const timeout = await loadTimeout();
  assert.equal(await timeout(Promise.resolve("ready"), 100, "Timed out"), "ready");
  const original = new Error("Request failed");
  await assert.rejects(
    timeout(Promise.reject(original), 100, "Timed out"),
    (error) => error === original,
  );
  await assert.rejects(timeout(new Promise(() => {}), 5, "Timed out"), /Timed out/);
});

test("access check verifies the caller and reads only their admin access", async () => {
  const source = await readFile("src/lib/admin-access.functions.ts", "utf8");
  const js = ts.transpileModule(
    source
      .replace('import { createServerFn } from "@tanstack/react-start";', "")
      .replace("export const", "const")
      .replace('await import("./auth.server")', "auth"),
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  let allowed = false;
  let signedIn = true;
  const calls = [];
  const handler = new Function("createServerFn", "auth", `${js}; return getAdminAccess;`)(
    () => ({ handler: (handler) => handler }),
    {
      requireUser: async () => {
        if (!signedIn) throw new Error("Sign in");
        return { userId: "caller", email: "caller@example.com" };
      },
      isAdmin: async (id) => {
        calls.push(id);
        return allowed;
      },
    },
  );
  assert.deepEqual(await handler(), {
    userId: "caller",
    email: "caller@example.com",
    isAdmin: false,
  });
  allowed = true;
  assert.equal((await handler()).isAdmin, true);
  signedIn = false;
  await assert.rejects(handler(), /Sign in/);
  assert.deepEqual(calls, ["caller", "caller"]);
  assert.doesNotMatch(source, /getCurrentMembership|getPlanEntitlements|\.from\("profiles"\)/);
});

test("admin layout isolates access cache by identity and offers retry without repeated automatic waits", async () => {
  const page = await readFile("src/routes/admin.tsx", "utf8");
  assert.doesNotMatch(page, /getAccountOverview/);
  assert.match(page, /queryKey: \["admin", "access", user\?\.id\]/);
  assert.match(page, /withRequestTimeout\(fetchAccess\(\)/);
  assert.match(page, /retry: false/);
  assert.match(page, /Try again/);
});

test("member queries run concurrently and scope membership reads to the displayed accounts", async () => {
  const server = await readFile("src/lib/admin.functions.ts", "utf8");
  const list = server.slice(
    server.indexOf("export const adminListMembers"),
    server.indexOf("const memberRoleSchema"),
  );
  assert.match(list, /Promise\.all\(/);
  assert.match(list, /if \(!userIds.length\) return \[\]/);
  assert.match(list, /\.in\("user_id", userIds\)/);
  assert.match(list, /\.lte\("starts_at", now\)/);
  assert.match(list, /ends_at\.is\.null,ends_at\.gt/);
});

test("auth initialization handles failed session checks and ignores stale reads after an auth event", async () => {
  const source = await readFile("src/hooks/useAuth.tsx", "utf8");
  assert.match(source, /authEventReceived = true/);
  assert.match(source, /if \(!active \|\| authEventReceived\) return/);
  assert.match(source, /\.catch\(/);
  assert.match(source, /setError\(new Error/);
  assert.match(source, /setLoading\(false\)/);
  assert.match(source, /clearTimeout\(timer\)/);
});
