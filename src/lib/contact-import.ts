export const CONTACT_IMPORT_FIELDS = [
  "email",
  "first_name",
  "last_name",
  "phone",
  "company",
  "source",
  "notes",
] as const;

export type ContactImportField = (typeof CONTACT_IMPORT_FIELDS)[number];
export type ContactImportMapping = Record<ContactImportField, number | null>;
export type ContactImportValues = {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  company?: string;
  source?: string;
  notes?: string;
};
export type ContactImportRow = {
  rowNumber: number;
  values: ContactImportValues;
  errors: string[];
  duplicateOfRow: number | null;
};

const headerAliases: Record<ContactImportField, string[]> = {
  email: ["email", "e-mail", "email address", "emailaddress"],
  first_name: ["first name", "firstname", "given name", "first_name"],
  last_name: ["last name", "lastname", "family name", "surname", "last_name"],
  phone: ["phone", "phone number", "telephone", "mobile"],
  company: ["company", "organisation", "organization", "business"],
  source: ["source", "lead source"],
  notes: ["notes", "note", "comments", "comment"],
};

function cleanHeader(value: string) {
  return value
    .trim()
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function parseContactCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let insideQuotes = false;
  let quoteClosed = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;

    if (insideQuotes) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        insideQuotes = false;
        quoteClosed = true;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      if (field.length > 0 || quoteClosed)
        throw new Error(`Unexpected quote near character ${index + 1}.`);
      insideQuotes = true;
      continue;
    }

    if (
      quoteClosed &&
      character !== "," &&
      character !== "\r" &&
      character !== "\n" &&
      !/\s/.test(character)
    ) {
      throw new Error(`Unexpected character after a closing quote near character ${index + 1}.`);
    }

    if (character === ",") {
      row.push(field.trim());
      field = "";
      quoteClosed = false;
      continue;
    }

    if (character === "\r" || character === "\n") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field.trim());
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      field = "";
      quoteClosed = false;
      continue;
    }

    if (!quoteClosed) field += character;
  }

  if (insideQuotes) throw new Error("The CSV ends inside a quoted field.");
  row.push(field.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);
  if (rows.length === 0) throw new Error("The CSV file is empty.");

  const headerCount = rows[0]!.length;
  if (headerCount === 0 || rows[0]!.every((header) => header === ""))
    throw new Error("The CSV needs a header row.");
  return rows;
}

export function suggestContactCsvMapping(headers: string[]): ContactImportMapping {
  const normalizedHeaders = headers.map(cleanHeader);
  return Object.fromEntries(
    CONTACT_IMPORT_FIELDS.map((field) => {
      const aliases = headerAliases[field].map(cleanHeader);
      const match = normalizedHeaders.findIndex((header) => aliases.includes(header));
      return [field, match >= 0 ? match : null] as const;
    }),
  ) as ContactImportMapping;
}

export function normalizeContactEmail(email: string) {
  return email.trim().toLowerCase();
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const maxLengths: Partial<Record<ContactImportField, number>> = {
  email: 320,
  first_name: 120,
  last_name: 120,
  phone: 80,
  company: 160,
  source: 80,
  notes: 5000,
};

export function mapContactCsvRows(
  rows: string[][],
  mapping: ContactImportMapping,
): ContactImportRow[] {
  const seenEmails = new Map<string, number>();

  return rows.slice(1).map((cells, index) => {
    const rowNumber = index + 2;
    const errors: string[] = [];
    const values: ContactImportValues = { email: "" };

    if (cells.length !== rows[0]!.length)
      errors.push(`Expected ${rows[0]!.length} columns but found ${cells.length}.`);

    for (const key of CONTACT_IMPORT_FIELDS) {
      const column = mapping[key];
      if (column === null || column === undefined || column < 0) continue;
      const value = (cells[column] ?? "").trim();
      if (key === "email") values.email = value;
      else if (value) values[key] = value;
    }

    if (mapping.email === null || mapping.email === undefined || mapping.email < 0) {
      errors.push("Map a CSV column to Email.");
    } else {
      values.email = normalizeContactEmail(values.email);
      if (!values.email) errors.push("Email is required.");
      else if (!validEmail(values.email)) errors.push("Enter a valid email address.");
    }

    for (const key of CONTACT_IMPORT_FIELDS) {
      const value = key === "email" ? values.email : values[key];
      const max = maxLengths[key];
      if (value && max && value.length > max)
        errors.push(`${key.replaceAll("_", " ")} exceeds ${max} characters.`);
    }
    if (
      mapping.source !== null &&
      mapping.source !== undefined &&
      mapping.source >= 0 &&
      values.source &&
      values.source.length < 2
    ) {
      errors.push("Source must contain at least 2 characters when provided.");
    }

    let duplicateOfRow: number | null = null;
    if (values.email && validEmail(values.email)) {
      duplicateOfRow = seenEmails.get(values.email) ?? null;
      if (duplicateOfRow !== null)
        errors.push(`Duplicate email in this file; row ${duplicateOfRow} is kept.`);
      else seenEmails.set(values.email, rowNumber);
    }

    return { rowNumber, values, errors, duplicateOfRow };
  });
}
