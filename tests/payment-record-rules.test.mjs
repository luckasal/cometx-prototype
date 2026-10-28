import assert from "node:assert/strict";
import test from "node:test";
import { amountToMinorUnits, bankTransferInputSchema, invoiceReferenceInputSchema } from "../src/lib/payment-record-rules.ts";

const bank = {
  partnerId: "11111111-1111-4111-8111-111111111111",
  amountMinor: 200000,
  currency: "CHF",
  paidOn: "2026-10-28",
  reference: "Partner ABC / Symposium",
  eventOrderReference: "Symposium",
  externalInvoiceId: "EXT-2026-42",
  financeVerified: true,
};

test("bank records require an explicit verification, valid money and a real paid date", () => {
  assert.equal(bankTransferInputSchema.safeParse(bank).success, true);
  assert.equal(bankTransferInputSchema.safeParse({ ...bank, financeVerified: false }).success, false);
  assert.equal(bankTransferInputSchema.safeParse({ ...bank, amountMinor: 0 }).success, false);
  assert.equal(bankTransferInputSchema.safeParse({ ...bank, amountMinor: 200000.1 }).success, false);
  assert.equal(bankTransferInputSchema.safeParse({ ...bank, paidOn: "2026-02-31" }).success, false);
});

test("issued invoices need a reference and document links must be HTTPS", () => {
  const base = { source: "bank", id: bank.partnerId, invoiceStatus: "issued" };
  assert.equal(invoiceReferenceInputSchema.safeParse(base).success, false);
  assert.equal(invoiceReferenceInputSchema.safeParse({ ...base, externalInvoiceId: "EXT-42" }).success, true);
  assert.equal(invoiceReferenceInputSchema.safeParse({ ...base, invoiceUrl: "https://invoices.example.com/42" }).success, true);
  assert.equal(invoiceReferenceInputSchema.safeParse({ ...base, invoiceUrl: "http://invoices.example.com/42" }).success, false);
  assert.equal(invoiceReferenceInputSchema.safeParse({ ...base, invoiceUrl: "javascript:alert(1)" }).success, false);
});

test("displayed money converts to minor units without floating-point rounding", () => {
  assert.equal(amountToMinorUnits("2000.00", "CHF"), 200000);
  assert.equal(amountToMinorUnits("0.29", "CHF"), 29);
  assert.equal(amountToMinorUnits("2000", "JPY"), 2000);
  assert.equal(amountToMinorUnits("2000.01", "JPY"), null);
  assert.equal(amountToMinorUnits("0", "CHF"), null);
  assert.equal(amountToMinorUnits("1.234", "CHF"), null);
});
