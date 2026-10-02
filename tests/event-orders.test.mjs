import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { eventOrdersInput } from "../src/lib/event-orders.ts";
import { readEventOrders } from "../src/lib/event-orders.server.ts";

const eventId = "11111111-1111-4111-8111-111111111111";
const otherEvent = "22222222-2222-4222-8222-222222222222";
const orderId = "33333333-3333-4333-8333-333333333333";
const input = (values = {}) => eventOrdersInput.parse({ eventId, ...values });
const attendee = {
  id: "ticket-1",
  event_id: eventId,
  attendee_name: "An attendee",
  attendee_email: "attendee@example.test",
  ticket_code: "ISSUED-1",
  status: "valid",
};
const line = {
  id: "line-1",
  event_id: eventId,
  ticket_name: "Standard",
  quantity: 2,
  unit_amount_minor: 500,
  amount_minor: 1000,
  currency: "CHF",
  price_basis: "member",
  ticket_attendees: [attendee],
};
const row = {
  id: orderId,
  event_id: null,
  buyer_name: "Buyer",
  buyer_email: "buyer@example.test",
  buyer_kind: "member",
  status: "confirmed",
  created_at: "2026-10-01T10:00:00Z",
  amount_minor: 4000,
  currency: "CHF",
  payments: [{ status: "paid" }],
  ticket_order_items: [line],
  guest_token_ciphertext: "private-secret",
  stripe_payment_intent_id: "private-provider-id",
};

function database(results) {
  const calls = [];
  const client = {
    from(table) {
      calls.push(["from", table]);
      const query = {};
      for (const method of ["select", "eq", "or", "order"]) {
        query[method] = (...args) => {
          calls.push([method, ...args]);
          return query;
        };
      }
      query.range = (...args) => {
        calls.push(["range", ...args]);
        return Promise.resolve(results.shift());
      };
      return query;
    },
  };
  return { client, calls };
}
const ok = (data = [row], count = data.length) => ({ data, count, error: null });

test("event boundary excludes other events' ticket lines and attendees; output excludes secrets", async () => {
  const { client, calls } = database([
    ok([
      {
        ...row,
        ticket_order_items: [
          {
            ...line,
            ticket_attendees: [
              attendee,
              { ...attendee, event_id: otherEvent, ticket_code: "OTHER-EVENT" },
            ],
          },
          { ...line, id: "other-line", event_id: otherEvent, amount_minor: 3000 },
        ],
      },
    ]),
  ]);
  const result = await readEventOrders(client, input());
  assert.ok(
    calls.some(
      (call) =>
        call[0] === "eq" && call[1] === "ticket_order_items.event_id" && call[2] === eventId,
    ),
  );
  assert.match(calls.find((call) => call[0] === "select")[1], /ticket_order_items!inner/);
  assert.equal(result.orders[0].lines.length, 1);
  assert.equal(result.orders[0].lines[0].attendees.length, 1);
  assert.equal(result.orders[0].orderTotalMinor, 4000);
  assert.equal(result.orders[0].lines[0].amountMinor, 1000);
  assert.doesNotMatch(JSON.stringify(result), /private-secret|private-provider-id|OTHER-EVENT/);
});

test("database pagination and filters apply before returning rows, with stable ordering", async () => {
  const { client, calls } = database([ok([], 523)]);
  const result = await readEventOrders(
    client,
    input({ page: 26, status: "refunded", buyerKind: "guest", search: "buyer@example.test" }),
  );
  assert.equal(result.total, 523);
  assert.deepEqual(
    calls.filter((call) => call[0] === "order"),
    [
      ["order", "created_at", { ascending: false }],
      ["order", "id", { ascending: false }],
    ],
  );
  assert.deepEqual(
    calls.find((call) => call[0] === "range"),
    ["range", 520, 539],
  );
  assert.ok(
    calls.some((call) => call[0] === "eq" && call[1] === "status" && call[2] === "refunded"),
  );
  assert.ok(
    calls.some((call) => call[0] === "eq" && call[1] === "buyer_kind" && call[2] === "guest"),
  );
  assert.deepEqual(calls.find((call) => call[0] === "select")[2], { count: "exact" });
});

test("legacy schema retry keeps event scope and filters", async () => {
  const { event_id: _unused, ...legacyLine } = line;
  const { client, calls } = database([
    { error: { code: "42703", message: "column ticket_order_items_1.event_id does not exist" } },
    ok([{ ...row, event_id: eventId, ticket_order_items: [legacyLine] }]),
  ]);
  const result = await readEventOrders(client, input({ status: "confirmed", page: 2 }));
  assert.equal(result.orders[0].lines.length, 1);
  assert.ok(
    calls.some((call) => call[0] === "eq" && call[1] === "event_id" && call[2] === eventId),
  );
  assert.equal(calls.filter((call) => call[0] === "eq" && call[1] === "status").length, 2);
  assert.deepEqual(
    calls.filter((call) => call[0] === "range"),
    [
      ["range", 40, 59],
      ["range", 40, 59],
    ],
  );
});

test("permission errors fail visibly without retrying an unscoped query", async () => {
  const { client, calls } = database([{ error: { code: "42501", message: "permission denied" } }]);
  await assert.rejects(readEventOrders(client, input()), /could not be loaded/);
  assert.equal(calls.filter((call) => call[0] === "from").length, 1);
});

test("search quotes filter punctuation and escapes literal wildcards; UUID searches are exact", async () => {
  const { client, calls } = database([ok([]), ok([])]);
  await readEventOrders(client, input({ search: 'a,b)("%_*\\' }));
  const expression = calls.find((call) => call[0] === "or")[1];
  const pattern = String.raw`%a,b)(\"\\%\\_\\*\\\\%`;
  assert.equal(expression, `buyer_name.ilike."${pattern}",buyer_email.ilike."${pattern}"`);
  await readEventOrders(client, input({ search: orderId }));
  assert.equal(calls.filter((call) => call[0] === "or")[1][1], `id.eq.${orderId}`);
});

test("input rejects invalid events, statuses, page values, and oversized searches", () => {
  for (const values of [
    { eventId: "not-an-id" },
    { status: "paid" },
    { page: -1 },
    { page: 0.5 },
    { search: "x".repeat(121) },
  ]) {
    assert.throws(() => input(values));
  }
});

const moduleUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
async function loadModule(path, imports) {
  let code = ts.transpileModule(await readFile(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  for (const [specifier, replacement] of Object.entries(imports))
    code = code.replaceAll(JSON.stringify(specifier), JSON.stringify(replacement));
  return import(moduleUrl(code));
}

test("server entry denies guests/non-admins before touching privileged data", async () => {
  const { adminListEventOrders } = await loadModule("../src/lib/event-orders.functions.ts", {
    "@tanstack/react-start": moduleUrl(
      "export const createServerFn=()=>({validator:()=>({handler:fn=>fn})});",
    ),
    "./event-orders": new URL("../src/lib/event-orders.ts", import.meta.url).href,
    "./auth.server": moduleUrl(
      'export async function requireAdmin(){throw new Error("Admin access required.");}',
    ),
    "@/integrations/supabase/client.server": moduleUrl(
      'throw new Error("Privileged client must not load");',
    ),
    "./event-orders.server": moduleUrl('throw new Error("Order reader must not load");'),
  });
  await assert.rejects(adminListEventOrders({ data: input() }), /Admin access required/);
});

test("order detail renders event subtotal separately from full order, with issued tickets and recorded benefit", async () => {
  const { EventOrderCard } = await loadModule("../src/components/admin/EventOrders.tsx", {
    react: import.meta.resolve("react"),
    "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
    "@tanstack/react-query": moduleUrl("export const useQuery=()=>({});"),
    "@tanstack/react-start": moduleUrl("export const useServerFn=fn=>fn;"),
    "@/lib/event-orders.functions": moduleUrl("export const adminListEventOrders=()=>{};"),
    "@/lib/event-orders": new URL("../src/lib/event-orders.ts", import.meta.url).href,
    "@/lib/pricing": new URL("../src/lib/pricing.ts", import.meta.url).href,
    "@/components/ui/button": moduleUrl(
      `import React from ${JSON.stringify(import.meta.resolve("react"))}; export const Button=({children})=>React.createElement('button',null,children);`,
    ),
    "@/components/site/Bits": moduleUrl(
      `import React from ${JSON.stringify(import.meta.resolve("react"))}; export const StatusPill=({children})=>React.createElement('span',null,children); export const EmptyBlock=()=>null; export const LoadingBlock=()=>null;`,
    ),
  });
  const { client } = database([ok()]);
  const { orders } = await readEventOrders(client, input());
  const html = renderToStaticMarkup(React.createElement(EventOrderCard, { order: orders[0] }));
  assert.match(html, /This event subtotal/);
  assert.match(html, /Full order total \(all events\)/);
  assert.match(html, /10/);
  assert.match(html, /40/);
  assert.match(html, /Signed-in buyer/);
  assert.match(html, /Member price/);
  assert.match(html, /ISSUED-1/);
  assert.match(html, /An attendee/);
  assert.doesNotMatch(html, /private-secret|private-provider-id/);
  const empty = renderToStaticMarkup(
    React.createElement(EventOrderCard, {
      order: {
        ...orders[0],
        status: "pending",
        paymentStatuses: [],
        lines: [{ ...orders[0].lines[0], attendees: [] }],
      },
    }),
  );
  assert.match(empty, /No payment recorded/);
  assert.match(empty, /No issued tickets recorded/);
});
