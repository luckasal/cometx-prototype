import test from "node:test";
import assert from "node:assert/strict";
import {
  mapContactCsvRows,
  normalizeContactEmail,
  parseContactCsv,
  suggestContactCsvMapping,
} from "../src/lib/contact-import.ts";

test("parses quoted CSV cells, commas, escaped quotes, newlines, and a BOM", () => {
  const rows = parseContactCsv(
    '\uFEFFEmail,First name,Notes\r\nLUCIA@example.com,"Lucia, L.","Said ""hello""\nand continued"\r\n',
  );
  assert.deepEqual(rows, [
    ["Email", "First name", "Notes"],
    ["LUCIA@example.com", "Lucia, L.", 'Said "hello"\nand continued'],
  ]);
});

test("rejects malformed quoted CSV instead of guessing at cell boundaries", () => {
  assert.throws(
    () => parseContactCsv('email,name\nhello@example.com,"unfinished'),
    /inside a quoted field/,
  );
  assert.throws(
    () => parseContactCsv('email,name\nhello@example.com,"quoted"tail'),
    /after a closing quote/,
  );
});

test("suggests common column headers and normalizes email for deduplication", () => {
  const headers = ["E-mail", "Given Name", "Family Name", "Business", "Lead Source"];
  assert.deepEqual(suggestContactCsvMapping(headers), {
    email: 0,
    first_name: 1,
    last_name: 2,
    phone: null,
    company: 3,
    source: 4,
    notes: null,
  });
  assert.equal(normalizeContactEmail("  Lucia@Example.COM  "), "lucia@example.com");
});

test("validates required email and row widths, and skips normalized duplicates within the file", () => {
  const rows = parseContactCsv(
    "Email,First Name,Notes\nUser@example.com,Ada,hello\nuser@EXAMPLE.com,Duplicate,second\nnot-an-email,Bad row,\nthird@example.com,Too few",
  );
  const mapping = suggestContactCsvMapping(rows[0]);
  const preview = mapContactCsvRows(rows, mapping);

  assert.equal(preview[0].values.email, "user@example.com");
  assert.equal(preview[0].errors.length, 0);
  assert.equal(preview[1].duplicateOfRow, 2);
  assert.match(preview[1].errors.join(" "), /Duplicate email/);
  assert.match(preview[2].errors.join(" "), /valid email address/);
  assert.match(preview[3].errors.join(" "), /Expected 3 columns but found 2/);
});

test("blank mapped cells are omitted so updates cannot silently clear existing values", () => {
  const rows = parseContactCsv("Email,First Name,Company\nnew@example.com,Ada,\n");
  const preview = mapContactCsvRows(rows, suggestContactCsvMapping(rows[0]));
  assert.deepEqual(preview[0].values, { email: "new@example.com", first_name: "Ada" });
});
