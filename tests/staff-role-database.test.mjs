import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "../.test-runtime/node_modules/@electric-sql/pglite/dist/index.js";

test("restricted role enum is idempotent and preserves direct Data API role isolation", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create type public.app_role as enum ('user','admin');
      create table public.user_roles(id uuid default gen_random_uuid(),user_id uuid not null,role public.app_role not null,unique(user_id,role));
      alter table public.user_roles enable row level security;
      grant select on public.user_roles to authenticated;
      grant usage on schema auth to authenticated;
      create function public.has_role(_user_id uuid,_role public.app_role) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.user_roles where user_id=_user_id and role=_role)$$;
      create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$select public.has_role(auth.uid(),'admin')$$;
      create policy own_roles on public.user_roles for select to authenticated using(user_id=auth.uid() or public.is_admin());
      create table public.contacts(id integer primary key,email text);
      alter table public.contacts enable row level security;
      grant select,insert,update,delete on public.contacts to authenticated;
      create policy contacts_admin on public.contacts for all to authenticated using(public.is_admin()) with check(public.is_admin());
      insert into public.contacts values(1,'private@example.com');
    `);
    const migration = await readFile(
      "supabase/migrations/20261012173752_restricted_staff_roles.sql",
      "utf8",
    );
    await db.exec(migration);
    await db.exec(migration);
    const roles = ["event_manager", "data_analyst", "marketing", "admin"];
    for (const [index, role] of roles.entries()) {
      const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
      await db.query("insert into public.user_roles(user_id,role) values($1,$2)", [id, role]);
      await db.exec(
        `set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`,
      );
      const own = await db.query("select role from public.user_roles");
      assert.equal(
        own.rows.some((row) => row.role === role),
        true,
      );
      const records = await db.query("select * from public.contacts");
      assert.equal(records.rows.length, role === "admin" ? 1 : 0);
      if (role !== "admin") {
        assert.equal(own.rows.length, 1);
        const updated = await db.query(
          "update public.contacts set email='changed' where id=1 returning id",
        );
        assert.equal(updated.rows.length, 0);
        await assert.rejects(db.query("insert into public.contacts values(2,'forbidden')"));
        await assert.rejects(
          db.query("insert into public.user_roles(user_id,role) values($1,'admin')", [id]),
        );
      }
      await db.exec("reset role;");
    }
    assert.equal(
      (await db.query("select email from public.contacts where id=1")).rows[0].email,
      "private@example.com",
    );
  } finally {
    await db.close();
  }
});
