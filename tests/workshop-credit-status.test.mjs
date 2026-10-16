import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile("src/lib/workshop-credit-status.ts", "utf8");
const js = ts.transpileModule(source.replace("export type WorkshopCreditOrder = { status: string; expires_at: string | null };", "type WorkshopCreditOrder = { status: string; expires_at: string | null };").replace("export function workshopCreditState", "function workshopCreditState"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const workshopCreditState = new Function(`${js}; return workshopCreditState;`)();

test("confirmed redemption is used, even if another checkout is pending", () => {
  assert.equal(workshopCreditState([{ status: "confirmed", expires_at: null }]), "used");
  assert.equal(workshopCreditState([
    { status: "pending", expires_at: "2099-01-01T00:00:00Z" },
    { status: "free", expires_at: null },
  ]), "used");
});

test("unexpired checkout reserves; expired, failed, and refunded orders do not", () => {
  const now = Date.parse("2026-10-16T12:00:00Z");
  assert.equal(workshopCreditState([{ status: "pending", expires_at: "2026-10-16T12:01:00Z" }], now), "reserved");
  assert.equal(workshopCreditState([{ status: "processing", expires_at: null }], now), "reserved");
  assert.equal(workshopCreditState([{ status: "pending", expires_at: "2026-10-16T11:59:00Z" }], now), "available");
  assert.equal(workshopCreditState([{ status: "failed", expires_at: null }, { status: "refunded", expires_at: null }], now), "available");
});
