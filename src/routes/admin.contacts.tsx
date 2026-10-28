import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminListContacts, adminListMemberOptions, adminSaveContact } from "@/lib/admin.functions";
import { AdminPage, AdminTable, Field, inputClass, textareaClass } from "@/components/admin/AdminBits";
import { Button } from "@/components/ui/button";
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from "@/components/site/Bits";
import { withRequestTimeout } from "@/lib/request-timeout";
import {
  CONTACT_IMPORT_FIELDS,
  mapContactCsvRows,
  parseContactCsv,
  suggestContactCsvMapping,
  type ContactImportField,
  type ContactImportMapping,
  type ContactImportRow,
} from "@/lib/contact-import";
import { adminImportContacts, adminPreviewContactImport } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/contacts")({ component: ContactsPage });

type ContactDraft = { id?: string; email: string; first_name: string; last_name: string; phone: string; company: string; source: string; newsletter_status: "subscribed" | "unsubscribed" | "pending"; member_id: string; notes: string };
const blank: ContactDraft = { email: "", first_name: "", last_name: "", phone: "", company: "", source: "manual", newsletter_status: "pending", member_id: "", notes: "" };
const contactFieldLabels: Record<ContactImportField, string> = {
  email: "Email (required)",
  first_name: "First name",
  last_name: "Last name",
  phone: "Phone",
  company: "Company",
  source: "Source",
  notes: "Notes",
};
const emptyMapping: ContactImportMapping = { email: null, first_name: null, last_name: null, phone: null, company: null, source: null, notes: null };
type ContactImportMode = "skip_existing" | "update_existing";
type ContactImportResult = {
  summary: { created: number; updated: number; skipped: number; failed: number };
  results: { rowNumber: number; email: string; status: "created" | "updated" | "skipped" | "failed"; message: string }[];
};

function ContactsPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "subscribed" | "unsubscribed" | "pending">("all");
  const [draft, setDraft] = useState<ContactDraft>(blank);
  const [importOpen, setImportOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvError, setCsvError] = useState("");
  const [mapping, setMapping] = useState<ContactImportMapping>(emptyMapping);
  const [importRows, setImportRows] = useState<ContactImportRow[]>([]);
  const [existingByEmail, setExistingByEmail] = useState<Record<string, number>>({});
  const [importMode, setImportMode] = useState<ContactImportMode>("skip_existing");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [importResult, setImportResult] = useState<ContactImportResult | null>(null);
  const fetchContacts = useServerFn(adminListContacts);
  const fetchMembers = useServerFn(adminListMemberOptions);
  const saveContact = useServerFn(adminSaveContact);
  const previewContactImport = useServerFn(adminPreviewContactImport);
  const runContactImport = useServerFn(adminImportContacts);
  const cache = useQueryClient();
  const contacts = useQuery({ queryKey: ["admin", "contacts", query, status], queryFn: () => withRequestTimeout(fetchContacts({ data: { query, status } }), 15000, "Loading contacts took too long. Please try again."), retry: false });
  const members = useQuery({ queryKey: ["admin", "member-options"], queryFn: () => withRequestTimeout(fetchMembers(), 15000, "Loading linked accounts took too long. Please try again."), retry: false });
  const save = useMutation({
    mutationFn: () => saveContact({ data: { ...draft, first_name: draft.first_name || null, last_name: draft.last_name || null, phone: draft.phone || null, company: draft.company || null, notes: draft.notes || null, member_id: draft.member_id || null } }),
    onSuccess: () => { toast.success("Contact saved"); setDraft(blank); cache.invalidateQueries({ queryKey: ["admin", "contacts"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const importContacts = useMutation({
    mutationFn: ({ rows, mode }: { rows: ContactImportRow[]; mode: ContactImportMode }) => runContactImport({
      data: {
        mode,
        rows: rows.map(({ rowNumber, values }) => {
          const { email, ...fields } = values;
          return { rowNumber, email, fields };
        }),
      },
    }),
    onSuccess: (result) => {
      setImportResult(result as ContactImportResult);
      cache.invalidateQueries({ queryKey: ["admin", "contacts"] });
      toast.success(`Contact import finished: ${result.summary.created} created, ${result.summary.updated} updated.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function readContactFile(file?: File) {
    setCsvError("");
    setCsvRows([]);
    setImportRows([]);
    setExistingByEmail({});
    setPreviewReady(false);
    setImportResult(null);
    if (!file) return;
    setImportMode("skip_existing");
    if (file.size > 5 * 1024 * 1024) {
      setCsvError("Choose a CSV file smaller than 5 MB.");
      return;
    }
    try {
      const rows = parseContactCsv(await file.text());
      if (rows[0]!.length > 50) throw new Error("The CSV can have at most 50 columns.");
      if (rows.length - 1 > 2000) throw new Error("The CSV can have at most 2,000 contact rows per import.");
      const headers = rows[0]!.map((header, index) => header || `Column ${index + 1}`);
      setCsvFileName(file.name);
      setCsvRows([headers, ...rows.slice(1)]);
      setMapping(suggestContactCsvMapping(headers));
    } catch (error) {
      setCsvFileName(file.name);
      setCsvError(error instanceof Error ? error.message : "Could not read this CSV file.");
    }
  }

  async function checkContactPreview() {
    setCsvError("");
    setImportResult(null);
    setPreviewReady(false);
    const rows = mapContactCsvRows(csvRows, mapping);
    setImportRows(rows);
    const validUniqueEmails = [...new Set(rows.filter((row) => row.errors.length === 0 && row.duplicateOfRow === null).map((row) => row.values.email))];
    setPreviewLoading(true);
    try {
      const response = validUniqueEmails.length ? await previewContactImport({ data: { emails: validUniqueEmails } }) : { matches: [] };
      setExistingByEmail(Object.fromEntries(response.matches.map((match) => [match.email, match.count])));
      setPreviewReady(true);
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : "Could not check existing contacts.");
    } finally {
      setPreviewLoading(false);
    }
  }

  const importCandidates = importRows.filter((row) =>
    row.errors.length === 0 && row.duplicateOfRow === null && (existingByEmail[row.values.email] ?? 0) <= 1,
  );
  const invalidImportRows = importRows.filter((row) => row.errors.length > 0 && row.duplicateOfRow === null).length;
  const duplicateFileRows = importRows.filter((row) => row.duplicateOfRow !== null).length;
  const ambiguousExistingRows = importRows.filter((row) => (existingByEmail[row.values.email] ?? 0) > 1).length;

  function exportContacts() {
    const rows = contacts.data ?? [];
    const values = ["email", "first_name", "last_name", "company", "source", "newsletter_status", "member_id"].map((key) => key).join(",") + "\n" + rows.map((contact) => [contact.email, contact.first_name, contact.last_name, contact.company, contact.source, contact.newsletter_status, contact.member_id].map((value) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([values], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "cometx-contacts.csv"; link.click(); URL.revokeObjectURL(url);
  }

  return <AdminPage title="Contacts" description="Newsletter and event leads. Contacts stay separate from authenticated members." action={<div className="flex flex-wrap gap-2"><Button type="button" onClick={() => setImportOpen((open) => !open)} variant="outlineInk">{importOpen ? "Close CSV import" : "Import CSV"}</Button><Button onClick={() => document.getElementById("new-contact")?.scrollIntoView({ behavior: "smooth" })} variant="ink">New contact</Button></div>}>
    <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
      <input className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email or company" />
      <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">All newsletter states</option><option value="subscribed">Subscribed</option><option value="pending">Pending</option><option value="unsubscribed">Unsubscribed</option></select>
      <Button type="button" variant="outlineInk" onClick={exportContacts} disabled={!contacts.data?.length}>Export CSV</Button>
    </div>
    {importOpen && <section className="mb-8 space-y-5 rounded-2xl border border-border/60 bg-card p-6" aria-labelledby="contact-csv-import-title">
      <div><h2 id="contact-csv-import-title" className="font-display text-lg font-bold">Import contacts from CSV</h2><p className="mt-1 text-sm text-muted-foreground">Reusable import for contact leads. The file is previewed before writing. New contacts stay pending for newsletter status; no member or sign-in accounts are created.</p></div>
      <Field label="CSV file (up to 5 MB, 2,000 rows)"><input type="file" accept=".csv,text/csv" className={inputClass} onChange={(event) => { void readContactFile(event.target.files?.[0]); }} /></Field>
      {csvFileName && <p className="text-sm">Selected file: <strong>{csvFileName}</strong></p>}
      {csvRows.length > 0 && <>
        <div><h3 className="mb-3 font-semibold">Match CSV columns</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{CONTACT_IMPORT_FIELDS.map((field) => <Field key={field} label={contactFieldLabels[field]}><select className={inputClass} value={mapping[field] === null ? "" : String(mapping[field])} required={field === "email"} onChange={(event) => { setMapping({ ...mapping, [field]: event.target.value === "" ? null : Number(event.target.value) }); setPreviewReady(false); setImportResult(null); }}><option value="">{field === "email" ? "Choose a column" : "Do not import"}</option>{csvRows[0]!.map((header, index) => <option key={`${index}-${header}`} value={index}>{header}</option>)}</select></Field>)}</div></div>
        <div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outlineInk" onClick={() => void checkContactPreview()} disabled={previewLoading}>{previewLoading ? "Checking contacts…" : "Preview import"}</Button>{previewReady && <span className="text-sm text-muted-foreground">{importRows.length} rows · {invalidImportRows} invalid · {duplicateFileRows} duplicate in file · {Object.values(existingByEmail).filter((count) => count === 1).length} matching existing contacts · {ambiguousExistingRows} ambiguous database matches</span>}</div>
        {previewReady && <>
          <fieldset className="space-y-2 rounded-xl border border-border/60 p-4"><legend className="px-1 font-semibold">If an email already exists</legend><label className="flex items-start gap-2 text-sm"><input type="radio" name="contact-import-mode" checked={importMode === "skip_existing"} onChange={() => { setImportMode("skip_existing"); setImportResult(null); }} /><span><strong>Skip existing contacts (recommended)</strong><br />This is the default; no existing contact fields change.</span></label><label className="flex items-start gap-2 text-sm"><input type="radio" name="contact-import-mode" checked={importMode === "update_existing"} onChange={() => { setImportMode("update_existing"); setImportResult(null); }} /><span><strong>Update existing contacts</strong><br />Explicitly updates only mapped, non-empty fields. Email, newsletter status, and linked member are preserved; blank cells never clear values.</span></label></fieldset>
          <div className="max-h-96 overflow-auto rounded-xl border border-border/60"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-card"><tr className="border-b border-border/60"><th className="px-3 py-2">Row</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Preview status</th><th className="px-3 py-2">Validation</th></tr></thead><tbody>{importRows.map((row) => { const matchCount = existingByEmail[row.values.email] ?? 0; const rowStatus = row.duplicateOfRow !== null ? "Duplicate in file" : row.errors.length ? "Invalid" : matchCount > 1 ? "Resolve duplicate records" : matchCount === 1 ? importMode === "skip_existing" ? "Existing · will skip" : "Existing · will update" : "New · pending"; return <tr key={row.rowNumber} className="border-b border-border/40 last:border-0"><td className="px-3 py-2">{row.rowNumber}</td><td className="px-3 py-2">{row.values.email || "—"}</td><td className="px-3 py-2">{rowStatus}</td><td className="px-3 py-2">{row.duplicateOfRow !== null ? `Duplicate email; row ${row.duplicateOfRow} is kept.` : row.errors.join(" ") || (matchCount > 1 ? `${matchCount} matching contacts in CometX.` : "—")}</td></tr>; })}</tbody></table></div>
          {ambiguousExistingRows > 0 && <p className="text-sm text-destructive">Rows matching multiple existing contacts are excluded. Resolve those duplicate records before retrying.</p>}
          <Button type="button" variant="ink" disabled={!importCandidates.length || importContacts.isPending} onClick={() => importContacts.mutate({ rows: importCandidates, mode: importMode })}>{importContacts.isPending ? "Importing…" : `Import ${importCandidates.length} valid row${importCandidates.length === 1 ? "" : "s"}`}</Button>
        </>}
      </>}
      {csvError && <p role="alert" className="text-sm text-destructive">{csvError}</p>}
      {importResult && <div className="space-y-2 rounded-xl border border-border/60 p-4" role="status"><h3 className="font-semibold">Import summary</h3><p className="text-sm">{importResult.summary.created} created · {importResult.summary.updated} updated · {importResult.summary.skipped} skipped · {importResult.summary.failed} failed · {invalidImportRows} invalid rows not submitted · {duplicateFileRows} duplicate rows in file not submitted · {ambiguousExistingRows} ambiguous matches not submitted</p><div className="max-h-64 overflow-auto"><ul className="list-disc pl-5 text-sm">{importResult.results.map((row) => <li key={`${row.rowNumber}-${row.email}`}>Row {row.rowNumber} ({row.email}) · {row.status}: {row.message}</li>)}</ul></div></div>}
    </section>}
    {contacts.isLoading && <LoadingBlock label="Loading contacts" />}
    {contacts.error && <div className="mb-5 space-y-3"><ErrorBlock error={contacts.error} /><Button variant="outlineInk" onClick={() => contacts.refetch()}>Try again</Button></div>}
    {contacts.data?.length === 0 && <EmptyBlock title="No contacts found" />}
    {contacts.data && contacts.data.length > 0 && <AdminTable head={["Contact", "Company", "Source", "Newsletter", "Linked member", "Added", ""]}>{contacts.data.map((contact) => <tr key={contact.id} className="[&>td]:px-4 [&>td]:py-3"><td><p className="font-medium">{[contact.first_name, contact.last_name].filter(Boolean).join(" ") || "-"}</p><p className="text-xs text-muted-foreground">{contact.email}</p></td><td>{contact.company ?? "-"}</td><td>{contact.source}</td><td><StatusPill tone={contact.newsletter_status === "subscribed" ? "success" : "muted"}>{contact.newsletter_status}</StatusPill></td><td>{contact.member_id ? "Linked" : "-"}</td><td>{new Date(contact.created_at).toLocaleDateString("en-GB")}</td><td><button className="text-xs underline" onClick={() => { setDraft({ id: contact.id, email: contact.email, first_name: contact.first_name ?? "", last_name: contact.last_name ?? "", phone: contact.phone ?? "", company: contact.company ?? "", source: contact.source, newsletter_status: contact.newsletter_status, member_id: contact.member_id ?? "", notes: contact.notes ?? "" }); document.getElementById("new-contact")?.scrollIntoView({ behavior: "smooth" }); }}>Edit</button></td></tr>)}</AdminTable>}
    <form id="new-contact" className="mt-10 space-y-5 rounded-2xl border border-border/60 bg-card p-6" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <h2 className="font-display text-lg font-bold">{draft.id ? "Edit contact" : "Add contact"}</h2>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Email"><input required type="email" className={inputClass} value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></Field><Field label="Source"><input required className={inputClass} value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })} /></Field><Field label="First name"><input className={inputClass} value={draft.first_name} onChange={(event) => setDraft({ ...draft, first_name: event.target.value })} /></Field><Field label="Last name"><input className={inputClass} value={draft.last_name} onChange={(event) => setDraft({ ...draft, last_name: event.target.value })} /></Field><Field label="Company"><input className={inputClass} value={draft.company} onChange={(event) => setDraft({ ...draft, company: event.target.value })} /></Field><Field label="Newsletter"><select className={inputClass} value={draft.newsletter_status} onChange={(event) => setDraft({ ...draft, newsletter_status: event.target.value as typeof draft.newsletter_status })}><option value="pending">Pending</option><option value="subscribed">Subscribed</option><option value="unsubscribed">Unsubscribed</option></select></Field><Field label="Link to member"><select className={inputClass} value={draft.member_id} onChange={(event) => setDraft({ ...draft, member_id: event.target.value })}><option value="">No linked member</option>{members.data?.map((member) => <option key={member.id} value={member.id}>{[member.first_name, member.last_name].filter(Boolean).join(" ") || member.email} · {member.email}</option>)}</select></Field></div>
      <Field label="Notes"><textarea className={textareaClass} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></Field><div className="flex gap-3"><Button type="submit" variant="ink" disabled={save.isPending}>{save.isPending ? "Saving..." : "Save contact"}</Button>{draft.id && <Button type="button" variant="outlineInk" onClick={() => setDraft(blank)}>New contact</Button>}</div>
    </form>
  </AdminPage>;
}
