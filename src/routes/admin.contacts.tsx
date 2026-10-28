import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminArchiveContact, adminBulkUpdateContacts, adminListContactDirectory, adminListContacts, adminListContactSegments, adminListMemberOptions, adminManageContactSegment, adminPrepareDirectoryContacts, adminRestoreContact, adminSaveContact, type AdminBulkContactInput } from "@/lib/admin.functions";
import { AdminPage, AdminTable, Field, inputClass, textareaClass } from "@/components/admin/AdminBits";
import { Button } from "@/components/ui/button";
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from "@/components/site/Bits";
import { withRequestTimeout } from "@/lib/request-timeout";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
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

type ContactDraft = { id?: string; email: string; first_name: string; last_name: string; phone: string; company: string; linkedin_url: string; birth_year: string; source: string; newsletter_status: "subscribed" | "unsubscribed" | "pending"; member_id: string; notes: string };
type MemberOption = { id: string; email: string | null; first_name: string | null; last_name: string | null };
const blank: ContactDraft = { email: "", first_name: "", last_name: "", phone: "", company: "", linkedin_url: "", birth_year: "", source: "manual", newsletter_status: "pending", member_id: "", notes: "" };
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
type DirectoryType = "All types" | "Contact record" | "Member account" | "Guest attendee" | "Partner organization" | "Speaker";

function ContactsPage() {
  const [activeView, setActiveView] = useState<"directory" | "manage">("manage");
  const [query, setQuery] = useState("");
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [directoryType, setDirectoryType] = useState<DirectoryType>("All types");
  const [selectedDirectoryIds, setSelectedDirectoryIds] = useState<string[]>([]);
  const [status, setStatus] = useState<"all" | "subscribed" | "unsubscribed" | "pending">("all");
  const [archive, setArchive] = useState<"active" | "archived">("active");
  const [segmentFilterId, setSegmentFilterId] = useState("");
  const [segmentManagerOpen, setSegmentManagerOpen] = useState(false);
  const [segmentName, setSegmentName] = useState("");
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [profileSegmentId, setProfileSegmentId] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [pendingPreparedContactIds, setPendingPreparedContactIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"subscribe" | "unsubscribe" | "segment_assign" | "segment_remove">("segment_assign");
  const [bulkSegmentId, setBulkSegmentId] = useState("");
  const [bulkSegmentName, setBulkSegmentName] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ updated: number; skipped: number; failed: number } | null>(null);
  const [bulkReviewOpen, setBulkReviewOpen] = useState(false);
  const [draft, setDraft] = useState<ContactDraft>(blank);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [editingSelected, setEditingSelected] = useState(false);
  const [saveError, setSaveError] = useState("");
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
  const fetchContactSegments = useServerFn(adminListContactSegments);
  const runContactBulkUpdate = useServerFn(adminBulkUpdateContacts);
  const manageContactSegment = useServerFn(adminManageContactSegment);
  const prepareDirectoryContacts = useServerFn(adminPrepareDirectoryContacts);
  const fetchDirectory = useServerFn(adminListContactDirectory);
  const fetchMembers = useServerFn(adminListMemberOptions);
  const saveContact = useServerFn(adminSaveContact);
  const previewContactImport = useServerFn(adminPreviewContactImport);
  const runContactImport = useServerFn(adminImportContacts);
  const cache = useQueryClient();
  const contacts = useQuery({ queryKey: ["admin", "contacts", query, status, archive, segmentFilterId], queryFn: () => withRequestTimeout(fetchContacts({ data: { query, status, archive, segmentId: segmentFilterId || null } }), 15000, "Loading contacts took too long. Please try again."), retry: false });
  const visibleContactIds = contacts.data?.map((contact) => contact.id) ?? [];
  const contactSegments = useQuery({ queryKey: ["admin", "contact-segments", visibleContactIds], queryFn: () => fetchContactSegments({ data: { contactIds: visibleContactIds } }), retry: false });
  useEffect(() => { setSelectedContactIds([]); setBulkResult(null); setBulkReviewOpen(false); }, [query, status, archive, segmentFilterId]);
  useEffect(() => {
    if (!pendingPreparedContactIds.length || !contacts.data) return;
    const visible = new Set(contacts.data.map((contact) => contact.id));
    setSelectedContactIds(pendingPreparedContactIds.filter((id) => visible.has(id)));
    setPendingPreparedContactIds([]);
  }, [contacts.data, pendingPreparedContactIds]);
  const activeSegments = contactSegments.data?.segments.filter((segment) => !segment.archived_at) ?? [];
  const directory = useQuery({ queryKey: ["admin", "contact-directory"], queryFn: () => withRequestTimeout(fetchDirectory(), 20000, "Loading the CometX directory took too long. Please try again."), retry: false });
  const members = useQuery({ queryKey: ["admin", "member-options"], queryFn: () => withRequestTimeout(fetchMembers(), 15000, "Loading linked accounts took too long. Please try again."), retry: false });
  const save = useMutation({
    mutationFn: () => saveContact({ data: { ...draft, first_name: draft.first_name || null, last_name: draft.last_name || null, phone: draft.phone || null, company: draft.company || null, linkedin_url: draft.linkedin_url.trim() || null, birth_year: draft.birth_year === "" ? null : Number(draft.birth_year), notes: draft.notes || null, member_id: draft.member_id || null } }),
    onSuccess: () => { toast.success("Contact saved"); setSaveError(""); if (draft.id) { setSelectedContactId(null); setEditingSelected(false); } else setArchive("active"); setDraft(blank); cache.invalidateQueries({ queryKey: ["admin", "contacts"] }); cache.invalidateQueries({ queryKey: ["admin", "contact-directory"] }); cache.invalidateQueries({ queryKey: ["admin", "newsletter"] }); },
    onError: (error: Error) => { setSaveError(error.message); toast.error(error.message); },
  });
  const archiveContact = useServerFn(adminArchiveContact);
  const restoreContact = useServerFn(adminRestoreContact);
  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveContact({ data: { id } }),
    onSuccess: () => { toast.success("Contact archived. Its record and history are preserved."); setSelectedContactId(null); cache.invalidateQueries({ queryKey: ["admin", "contacts"] }); cache.invalidateQueries({ queryKey: ["admin", "contact-directory"] }); cache.invalidateQueries({ queryKey: ["admin", "newsletter"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreContact({ data: { id } }),
    onSuccess: () => { toast.success("Contact restored"); setSelectedContactId(null); cache.invalidateQueries({ queryKey: ["admin", "contacts"] }); cache.invalidateQueries({ queryKey: ["admin", "contact-directory"] }); cache.invalidateQueries({ queryKey: ["admin", "newsletter"] }); },
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
  const bulkUpdateContacts = useMutation({
    mutationFn: (data: AdminBulkContactInput) => runContactBulkUpdate({ data }),
    onSuccess: (result) => {
      setBulkResult(result);
      setSelectedContactIds([]);
      setBulkReviewOpen(false);
      setProfileSegmentId("");
      setConsentConfirmed(false);
      cache.invalidateQueries({ queryKey: ["admin", "contacts"] });
      cache.invalidateQueries({ queryKey: ["admin", "contact-segments"] });
      cache.invalidateQueries({ queryKey: ["admin", "contact-directory"] });
      cache.invalidateQueries({ queryKey: ["admin", "newsletter"] });
      toast.success(`Bulk update finished: ${result.updated} updated, ${result.skipped} unchanged, ${result.failed} failed.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const updateSegment = useMutation({
    mutationFn: (data: { action: "create"; name: string } | { action: "rename"; id: string; name: string } | { action: "archive" | "restore"; id: string }) => manageContactSegment({ data }),
    onSuccess: (result) => {
      toast.success(result.message);
      setSegmentName("");
      setEditingSegmentId(null);
      setBulkSegmentId("");
      cache.invalidateQueries({ queryKey: ["admin", "contact-segments"] });
      cache.invalidateQueries({ queryKey: ["admin", "contacts"] });
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
  const selectedContact = contacts.data?.find((contact) => contact.id === selectedContactId) ?? null;
  const selectedContactSegments = contactSegments.data?.assignments.filter((assignment) => assignment.contact_id === selectedContactId).map((assignment) => contactSegments.data?.segments.find((segment) => segment.id === assignment.segment_id)).filter((segment): segment is NonNullable<typeof segment> => Boolean(segment)) ?? [];
  const availableProfileSegments = activeSegments.filter((segment) => !selectedContactSegments.some((assigned) => assigned.id === segment.id));
  const selectedMember = selectedContact?.member_id ? members.data?.find((member) => member.id === selectedContact.member_id) : null;
  const directoryEntries = (directory.data?.entries ?? []).filter((entry) => {
    const matchesType = directoryType === "All types" || entry.types.includes(directoryType);
    const needle = directoryQuery.trim().toLocaleLowerCase();
    const matchesSearch = !needle || [entry.name, entry.email, entry.phone, entry.company, entry.website_url, entry.linkedin_url, entry.birth_year?.toString(), entry.newsletter_status, entry.notes, ...entry.context]
      .some((value) => value?.toLocaleLowerCase().includes(needle));
    return matchesType && matchesSearch;
  });
  const selectableDirectoryEntries = directoryEntries.filter((entry) => entry.email && (entry.contact_id || entry.member_id || entry.types.includes("Guest attendee")));
  const prepareDirectory = useMutation({
    mutationFn: () => prepareDirectoryContacts({ data: { people: directoryEntries.filter((entry) => selectedDirectoryIds.includes(entry.id) && entry.email).map((entry) => ({ email: entry.email!, memberId: entry.member_id })) } }),
    onSuccess: (result) => {
      setSelectedDirectoryIds([]);
      setActiveView("manage");
      setQuery(""); setStatus("all"); setArchive("active"); setSegmentFilterId("");
      cache.invalidateQueries({ queryKey: ["admin", "contacts"] });
      cache.invalidateQueries({ queryKey: ["admin", "contact-directory"] });
      setPendingPreparedContactIds(result.contactIds);
      toast.success(`${result.contactIds.length} ready for bulk edit · ${result.created} contact profiles created · ${result.skipped} skipped.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function openContact(contact: NonNullable<typeof contacts.data>[number]) {
    setSelectedContactId(contact.id);
    setEditingSelected(false);
    setDraft(blank);
    setSaveError("");
  }

  function startEditingContact(contact: NonNullable<typeof contacts.data>[number]) {
    setDraft({ id: contact.id, email: contact.email, first_name: contact.first_name ?? "", last_name: contact.last_name ?? "", phone: contact.phone ?? "", company: contact.company ?? "", linkedin_url: contact.linkedin_url ?? "", birth_year: contact.birth_year === null ? "" : String(contact.birth_year), source: contact.source, newsletter_status: contact.newsletter_status, member_id: contact.member_id ?? "", notes: contact.notes ?? "" });
    setEditingSelected(true);
    setSaveError("");
  }

  function openDirectoryContactProfile(entry: NonNullable<typeof directory.data>["entries"][number]) {
    if (entry.contact_id) {
      const contact = contacts.data?.find((row) => row.id === entry.contact_id);
      if (contact) openContact(contact);
      else {
        setArchive("archived");
        setActiveView("manage");
        requestAnimationFrame(() => document.getElementById("contacts-records")?.scrollIntoView({ behavior: "smooth" }));
      }
      return;
    }
    if (!entry.email) return;
    setSelectedContactId(null);
    setEditingSelected(false);
    setDraft({
      ...blank,
      email: entry.email,
      first_name: entry.name,
      phone: entry.phone ?? "",
      company: entry.company ?? "",
      linkedin_url: entry.linkedin_url ?? "",
      birth_year: entry.birth_year === null ? "" : String(entry.birth_year),
      source: "directory",
      member_id: entry.member_id ?? "",
      newsletter_status: "pending",
      notes: entry.notes ?? "",
    });
    setSaveError("");
    document.getElementById("new-contact")?.scrollIntoView({ behavior: "smooth" });
  }

  function confirmArchive(contact: NonNullable<typeof contacts.data>[number]) {
    if (window.confirm(`Archive ${contact.email}? This hides the contact from active and newsletter views but preserves the record and all linked history. You can restore it later.`)) archiveMutation.mutate(contact.id);
  }

  function exportContacts() {
    const rows = contacts.data ?? [];
    const values = ["email", "first_name", "last_name", "company", "linkedin_url", "birth_year", "source", "newsletter_status", "member_id"].join(",") + "\n" + rows.map((contact) => [contact.email, contact.first_name, contact.last_name, contact.company, contact.linkedin_url, contact.birth_year, contact.source, contact.newsletter_status, contact.member_id].map((value) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([values], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "cometx-contacts.csv"; link.click(); URL.revokeObjectURL(url);
  }

  function reviewBulkUpdate() {
    if (!selectedContactIds.length) return;
    if (bulkAction === "subscribe" && !consentConfirmed) { toast.error("Confirm documented opt-in consent for every selected contact."); return; }
    if (bulkAction === "segment_assign" && !bulkSegmentId && !bulkSegmentName.trim()) { toast.error("Choose or create a segment."); return; }
    if (bulkAction === "segment_remove" && !bulkSegmentId) { toast.error("Choose a segment to remove."); return; }
    setBulkReviewOpen(true);
  }

  function submitBulkUpdate() {
    if (!selectedContactIds.length) return;
    if (bulkAction === "subscribe" || bulkAction === "unsubscribe") {
      bulkUpdateContacts.mutate({ action: "newsletter", status: bulkAction === "subscribe" ? "subscribed" : "unsubscribed", consentConfirmed: true, contactIds: selectedContactIds });
    } else if (bulkAction === "segment_assign") {
      const segment = contactSegments.data?.segments.find((item) => item.id === bulkSegmentId);
      bulkUpdateContacts.mutate({ action: "segment_assign", contactIds: selectedContactIds, ...(segment ? { segmentId: segment.id } : { segmentName: bulkSegmentName.trim() }) });
    } else {
      bulkUpdateContacts.mutate({ action: "segment_remove", contactIds: selectedContactIds, segmentId: bulkSegmentId });
    }
  }

  const bulkActionLabel = bulkAction === "subscribe" ? "Mark subscribed" : bulkAction === "unsubscribe" ? "Unsubscribe" : bulkAction === "segment_assign" ? "Add segment" : "Remove segment";
  const bulkSegmentLabel = contactSegments.data?.segments.find((item) => item.id === bulkSegmentId)?.name ?? bulkSegmentName.trim();

  return <AdminPage title="Contacts" description="Find everyone in CometX, or manage contact records and their newsletter consent and segments." action={<div className="flex flex-wrap gap-2"><Button type="button" onClick={() => setImportOpen((open) => !open)} variant="outlineInk">{importOpen ? "Close CSV import" : "Import CSV"}</Button><Button onClick={() => document.getElementById("new-contact")?.scrollIntoView({ behavior: "smooth" })} variant="ink">New contact</Button></div>}>
    <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Contact views">
      <Button type="button" aria-pressed={activeView === "directory"} variant={activeView === "directory" ? "ink" : "outlineInk"} onClick={() => setActiveView("directory")}>Everyone in CometX</Button>
      <Button type="button" aria-pressed={activeView === "manage"} variant={activeView === "manage" ? "ink" : "outlineInk"} onClick={() => setActiveView("manage")}>Manage contacts & bulk edit</Button>
    </div>
    {activeView === "directory" && <section className="mb-10 space-y-4" aria-labelledby="cometx-directory-title">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="cometx-directory-title" className="font-display text-xl font-bold">Everyone in CometX</h2><p className="mt-1 text-sm text-muted-foreground">People with the same email or an explicit member link are grouped into one row. Contact profile details are shown alongside their account and event history; the original records remain in their own sections.</p></div><span className="text-sm text-muted-foreground">{directoryEntries.length} {directoryType === "All types" ? "people and organizations" : directoryType.toLocaleLowerCase() + (directoryEntries.length === 1 ? "" : "s")}</span></div>
      <div className="grid gap-3 sm:grid-cols-[1fr_240px]"><input aria-label="Search everyone in CometX" className={inputClass} value={directoryQuery} onChange={(event) => setDirectoryQuery(event.target.value)} placeholder="Search name, email, company or event" /><select aria-label="Directory record type" className={inputClass} value={directoryType} onChange={(event) => setDirectoryType(event.target.value as DirectoryType)}><option>All types</option>{(directory.data?.availableTypes ?? []).map((type) => <option key={type}>{type}</option>)}</select></div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 p-3 text-sm"><strong>{selectedDirectoryIds.length} selected for bulk edit</strong><Button type="button" variant="outlineInk" onClick={() => setSelectedDirectoryIds(selectableDirectoryEntries.map((entry) => entry.id))} disabled={!selectableDirectoryEntries.length}>Select shown people with email</Button><Button type="button" variant="outlineInk" onClick={() => setSelectedDirectoryIds([])} disabled={!selectedDirectoryIds.length}>Clear</Button><Button type="button" variant="ink" disabled={!selectedDirectoryIds.length || selectedDirectoryIds.length > 100 || prepareDirectory.isPending} onClick={() => { const missing = directoryEntries.filter((entry) => selectedDirectoryIds.includes(entry.id) && !entry.contact_id).length; if (missing && !window.confirm(`Prepare ${selectedDirectoryIds.length} selected people for bulk edit? This may create up to ${missing} contact profiles with pending newsletter status. It will not subscribe anyone.`)) return; prepareDirectory.mutate(); }}>{prepareDirectory.isPending ? "Preparing…" : `Continue to bulk edit (${selectedDirectoryIds.length})`}</Button><span className="text-muted-foreground">Members and guests with email can get a pending contact profile. Partners and speakers without email cannot be matched safely.</span></div>
      {directory.isLoading && <LoadingBlock label="Loading the CometX directory" />}
      {directory.error && <div className="space-y-3"><ErrorBlock error={directory.error} /><Button variant="outlineInk" onClick={() => directory.refetch()}>Try again</Button></div>}
      {directory.data && directoryEntries.length === 0 && <EmptyBlock title="No directory records found" />}
      {directory.data && directoryEntries.length > 0 && <AdminTable head={["Select / sources", "Name", "Email", "Company / website", "Contact profile", "CometX context", "Added", "Profile"]}>{directoryEntries.map((entry) => <tr key={entry.id} className="[&>td]:px-4 [&>td]:py-3"><td><div className="flex max-w-48 flex-wrap gap-1">{entry.email && (entry.contact_id || entry.member_id || entry.types.includes("Guest attendee")) && <input type="checkbox" aria-label={`Select ${entry.name || entry.email} for bulk edit`} checked={selectedDirectoryIds.includes(entry.id)} onChange={(event) => setSelectedDirectoryIds((current) => event.target.checked ? [...new Set([...current, entry.id])] : current.filter((id) => id !== entry.id))} />}{entry.types.map((type) => <StatusPill key={type} tone={type === "Partner organization" ? "success" : "muted"}>{type}{(entry.sourceCounts[type] ?? 0) > 1 ? ` × ${entry.sourceCounts[type]}` : ""}</StatusPill>)}</div></td><td className="font-medium">{entry.name || "Unnamed"}</td><td>{entry.email ?? "—"}</td><td>{entry.company ?? (entry.website_url ? <a className="underline" href={entry.website_url} target="_blank" rel="noreferrer">Website</a> : "—")}</td><td className="min-w-48 text-sm">{entry.phone && <div>Phone: {entry.phone}</div>}{entry.linkedin_url && <div className="max-w-56 truncate"><a className="underline" href={entry.linkedin_url} target="_blank" rel="noreferrer">LinkedIn</a></div>}{entry.birth_year && <div>Birth year: {entry.birth_year}</div>}{entry.newsletter_status && <div>Newsletter: {entry.newsletter_status}</div>}{entry.notes && <div className="max-w-64 truncate" title={entry.notes}>Notes: {entry.notes}</div>}{!entry.phone && !entry.linkedin_url && !entry.birth_year && !entry.newsletter_status && !entry.notes && "—"}</td><td className="min-w-48 text-sm text-muted-foreground">{entry.context.map((detail, index) => <div key={`${index}-${detail}`}>{detail}</div>)}</td><td>{entry.created_at ? new Date(entry.created_at).toLocaleDateString("en-GB") : "—"}</td><td>{entry.email && (entry.types.includes("Contact record") || entry.types.includes("Member account") || entry.types.includes("Guest attendee")) && <button type="button" className="text-xs underline" onClick={() => openDirectoryContactProfile(entry)}>{entry.contact_id ? "Edit profile" : "Add profile"}</button>}</td></tr>)}</AdminTable>}
      <p className="text-xs text-muted-foreground">People are grouped only when their normalized email matches or a member account is explicitly linked. Partner organizations stay separate, and speakers without an email are not guessed into a person record. Add or edit a contact profile to maintain phone, company, LinkedIn, birth year, newsletter status and notes.</p>
      <Button type="button" variant="outlineInk" onClick={() => setActiveView("manage")}>Manage contact records and bulk actions</Button>
    </section>}
    {activeView === "manage" && <section id="contacts-records" className="mb-10" aria-labelledby="contact-records-title">
    <div className="mb-4"><h2 id="contact-records-title" className="font-display text-xl font-bold">Manage contact records</h2><p className="mt-1 text-sm text-muted-foreground">Select rows below to update newsletter consent or segments. Other directory records need a contact profile before they can be bulk edited.</p></div>
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_180px_180px_200px_auto_auto]">
      <input className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email or company" />
      <select aria-label="Newsletter status" className={inputClass} value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">All newsletter states</option><option value="subscribed">Subscribed</option><option value="pending">Pending</option><option value="unsubscribed">Unsubscribed</option></select>
      <select aria-label="Contact archive status" className={inputClass} value={archive} onChange={(event) => setArchive(event.target.value as typeof archive)}><option value="active">Active contacts</option><option value="archived">Archived contacts</option></select>
      <select aria-label="Filter by segment" className={inputClass} value={segmentFilterId} onChange={(event) => setSegmentFilterId(event.target.value)}><option value="">All segments</option>{(contactSegments.data?.segments ?? []).map((segment) => <option key={segment.id} value={segment.id}>{segment.name}{segment.archived_at ? " (archived)" : ""}</option>)}</select>
      <Button type="button" variant="outlineInk" onClick={() => setSegmentManagerOpen(true)}>Manage segments</Button>
      <Button type="button" variant="outlineInk" onClick={exportContacts} disabled={!contacts.data?.length}>Export CSV</Button>
    </div>
    {bulkResult && <p className="mb-4 rounded-lg border border-border/60 p-3 text-sm" role="status">Bulk update complete: {bulkResult.updated} updated · {bulkResult.skipped} unchanged · {bulkResult.failed} failed.</p>}
    {archive === "active" && contacts.data && contacts.data.length > 0 && <section className="mb-5 space-y-4 rounded-2xl border border-border/60 bg-card p-5" aria-label="Bulk contact actions">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">1. Select contacts</h3><p className="text-sm text-muted-foreground">{selectedContactIds.length} of {visibleContactIds.length} loaded contacts selected. Filters apply before selection.</p></div><div className="flex gap-2"><Button type="button" variant="outlineInk" onClick={() => { setSelectedContactIds(visibleContactIds); setBulkResult(null); }}>Select all shown</Button><Button type="button" variant="outlineInk" onClick={() => setSelectedContactIds([])} disabled={!selectedContactIds.length}>Clear</Button></div></div>
      <div className="space-y-3 border-t border-border/60 pt-4"><h3 className="font-semibold">2. Choose one change</h3><div className="flex flex-wrap gap-2" role="group" aria-label="Bulk action">{([['segment_assign', 'Add segment'], ['segment_remove', 'Remove segment'], ['subscribe', 'Mark subscribed'], ['unsubscribe', 'Unsubscribe']] as const).map(([action, label]) => <Button key={action} type="button" variant={bulkAction === action ? "ink" : "outlineInk"} aria-pressed={bulkAction === action} onClick={() => { setBulkAction(action); setConsentConfirmed(false); setBulkResult(null); setBulkReviewOpen(false); }}>{label}</Button>)}</div>
        {bulkAction === "segment_assign" && <>{activeSegments.length ? <select aria-label="Segment to assign" className={`${inputClass} max-w-64`} value={bulkSegmentId} onChange={(event) => setBulkSegmentId(event.target.value)}><option value="">Create a new segment…</option>{activeSegments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}</select> : null}{!bulkSegmentId && <input aria-label="New segment name" className={`${inputClass} max-w-64`} value={bulkSegmentName} onChange={(event) => setBulkSegmentName(event.target.value)} placeholder="New segment name" maxLength={80} />}</>}
        {bulkAction === "segment_remove" && <select aria-label="Segment to remove" className={`${inputClass} max-w-64`} value={bulkSegmentId} onChange={(event) => setBulkSegmentId(event.target.value)}><option value="">Choose segment…</option>{(contactSegments.data?.segments ?? []).map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}</select>}
        {bulkAction === "subscribe" && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={consentConfirmed} onChange={(event) => setConsentConfirmed(event.target.checked)} /><span>I confirm current opt-in consent is documented for every selected contact.</span></label>}
        {bulkAction === "unsubscribe" && <p className="text-sm text-muted-foreground">This marks selected contacts unsubscribed and keeps their recorded consent timestamp.</p>}
      </div>
      <div className="border-t border-border/60 pt-4"><h3 className="mb-2 font-semibold">3. Review and apply</h3><Button type="button" variant="ink" disabled={!selectedContactIds.length || bulkUpdateContacts.isPending || ((bulkAction === "segment_assign" || bulkAction === "segment_remove") && (contactSegments.isLoading || Boolean(contactSegments.error))) || (bulkAction === "segment_assign" && !bulkSegmentId && !bulkSegmentName.trim()) || (bulkAction === "segment_remove" && !bulkSegmentId) || (bulkAction === "subscribe" && !consentConfirmed)} onClick={reviewBulkUpdate}>Review change for {selectedContactIds.length}</Button></div>
      {contactSegments.error && <p role="alert" className="text-sm text-destructive">Segments could not be loaded: {contactSegments.error.message}. Refresh before assigning or removing.</p>}
      <p className="text-xs text-muted-foreground">Only contact profiles can be changed here. “Select all shown” covers the loaded filtered records, up to 500. No unrelated profile fields are changed.</p>
    </section>}
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
    {contacts.data?.length === 0 && <EmptyBlock title={archive === "archived" ? "No archived contacts found" : "No contacts found"} />}
    {contacts.data && contacts.data.length > 0 && <AdminTable head={["Select", "Contact", "Company", "Source", "Newsletter", "Segments", "Linked member", "Added", "Actions"]}>{contacts.data.map((contact) => { const assignedSegments = contactSegments.data?.assignments.filter((assignment) => assignment.contact_id === contact.id).map((assignment) => contactSegments.data?.segments.find((segment) => segment.id === assignment.segment_id)).filter((segment): segment is NonNullable<typeof segment> => Boolean(segment)) ?? []; return <tr key={contact.id} className="[&>td]:px-4 [&>td]:py-3"><td>{archive === "active" && <input aria-label={`Select ${contact.email}`} type="checkbox" checked={selectedContactIds.includes(contact.id)} onChange={(event) => { setSelectedContactIds((current) => event.target.checked ? [...new Set([...current, contact.id])] : current.filter((id) => id !== contact.id)); setBulkResult(null); }} />}</td><td><button type="button" className="text-left" onClick={() => openContact(contact)}><span className="font-medium underline">{[contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Unnamed contact"}</span></button><p className="text-xs text-muted-foreground">{contact.email}</p>{contact.linkedin_url && <p className="text-xs"><a href={contact.linkedin_url} target="_blank" rel="noreferrer" className="underline">LinkedIn profile</a></p>}{contact.birth_year && <p className="text-xs text-muted-foreground">Birth year: {contact.birth_year}</p>}</td><td>{contact.company ?? "-"}</td><td>{contact.source}</td><td><StatusPill tone={contact.newsletter_status === "subscribed" ? "success" : "muted"}>{contact.newsletter_status}</StatusPill></td><td><div className="flex max-w-48 flex-wrap gap-1">{assignedSegments.map((segment) => <StatusPill key={segment.id} tone="muted">{segment.name}</StatusPill>)}{contactSegments.isLoading && <span className="text-xs text-muted-foreground">Loading…</span>}{!contactSegments.isLoading && !assignedSegments.length && "—"}</div></td><td>{contact.member_id ? "Linked" : "-"}</td><td>{new Date(contact.created_at).toLocaleDateString("en-GB")}</td><td><div className="flex flex-wrap gap-3"><button type="button" className="text-xs underline" onClick={() => openContact(contact)}>View</button>{archive === "active" ? <button type="button" className="text-xs underline" disabled={archiveMutation.isPending} onClick={() => confirmArchive(contact)}>Archive</button> : <button type="button" className="text-xs underline" disabled={restoreMutation.isPending} onClick={() => restoreMutation.mutate(contact.id)}>Restore</button>}</div></td></tr>; })}</AdminTable>}
    </section>}
    <form id="new-contact" className="mt-10 space-y-5 rounded-2xl border border-border/60 bg-card p-6" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <h2 className="font-display text-lg font-bold">Add contact</h2>
      <ContactEditorFields draft={draft} members={members.data ?? []} onChange={setDraft} />
      {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
      <div className="flex gap-3"><Button type="submit" variant="ink" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save contact"}</Button><Button type="button" variant="outlineInk" disabled={save.isPending} onClick={() => { setDraft(blank); setSaveError(""); }}>Cancel</Button></div>
    </form>
    <Dialog open={segmentManagerOpen} onOpenChange={setSegmentManagerOpen}>
      <DialogContent className="max-h-[88dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl bg-card">
        <DialogTitle className="font-display text-xl font-bold">Manage contact segments</DialogTitle>
        <DialogDescription>Create labels for contacts. A contact can have several segments; newsletter consent is managed separately.</DialogDescription>
        <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); if (editingSegmentId) updateSegment.mutate({ action: "rename", id: editingSegmentId, name: segmentName }); else updateSegment.mutate({ action: "create", name: segmentName }); }}>
          <input aria-label={editingSegmentId ? "Rename segment" : "New segment name"} className={`${inputClass} min-w-48 flex-1`} required maxLength={80} value={segmentName} onChange={(event) => setSegmentName(event.target.value)} placeholder={editingSegmentId ? "Rename segment" : "New segment name"} />
          <Button type="submit" variant="ink" disabled={updateSegment.isPending || !segmentName.trim()}>{editingSegmentId ? "Save name" : "Create segment"}</Button>
          {editingSegmentId && <Button type="button" variant="outlineInk" onClick={() => { setEditingSegmentId(null); setSegmentName(""); }}>Cancel edit</Button>}
        </form>
        {contactSegments.isLoading && <LoadingBlock label="Loading segments" />}
        {contactSegments.error && <ErrorBlock error={contactSegments.error} />}
        {contactSegments.data?.segments.length === 0 && <p className="text-sm text-muted-foreground">No segments yet. Create the first one above.</p>}
        <ul className="space-y-2">{(contactSegments.data?.segments ?? []).map((segment) => <li key={segment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 p-3 text-sm"><span><strong>{segment.name}</strong>{segment.archived_at && <span className="ml-2 text-muted-foreground">Archived · existing assignments kept</span>}</span><span className="flex gap-2"><Button type="button" variant="outlineInk" disabled={updateSegment.isPending} onClick={() => { setEditingSegmentId(segment.id); setSegmentName(segment.name); }}>Rename</Button>{segment.archived_at ? <Button type="button" variant="outlineInk" disabled={updateSegment.isPending} onClick={() => updateSegment.mutate({ action: "restore", id: segment.id })}>Restore</Button> : <Button type="button" variant="outlineInk" disabled={updateSegment.isPending} onClick={() => { if (window.confirm(`Archive “${segment.name}”? Existing contact assignments remain, and you can restore it later.`)) updateSegment.mutate({ action: "archive", id: segment.id }); }}>Archive</Button>}</span></li>)}</ul>
      </DialogContent>
    </Dialog>
    <Dialog open={bulkReviewOpen} onOpenChange={(open) => { if (!bulkUpdateContacts.isPending) setBulkReviewOpen(open); }}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-card">
        <DialogTitle className="font-display text-xl font-bold">Review bulk change</DialogTitle>
        <DialogDescription>Check the action and number of contacts before applying it.</DialogDescription>
        <div className="space-y-2 rounded-xl border border-border/60 p-4 text-sm">
          <p><strong>Action:</strong> {bulkActionLabel}{(bulkAction === "segment_assign" || bulkAction === "segment_remove") && ` · ${bulkSegmentLabel}`}</p>
          <p><strong>Contacts:</strong> {selectedContactIds.length} selected from the current filtered list</p>
          <p className="text-muted-foreground">Only newsletter status or the selected segment assignment will change. Other contact fields remain as they are.</p>
          {bulkAction === "subscribe" && <p>Current opt-in consent has been confirmed for every selected contact.</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outlineInk" disabled={bulkUpdateContacts.isPending} onClick={() => setBulkReviewOpen(false)}>Back</Button><Button type="button" variant="ink" disabled={bulkUpdateContacts.isPending} onClick={submitBulkUpdate}>{bulkUpdateContacts.isPending ? "Applying…" : `Apply to ${selectedContactIds.length} contacts`}</Button></div>
      </DialogContent>
    </Dialog>
    {selectedContact && <Dialog open onOpenChange={(open) => { if (!open) { setSelectedContactId(null); setEditingSelected(false); setDraft(blank); } }}>
      <DialogContent className="max-h-[88dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl bg-card">
        <div className="pr-7"><DialogTitle className="font-display text-xl font-bold">{editingSelected ? "Edit contact" : "Contact details"}</DialogTitle><DialogDescription className="mt-1">{selectedContact.email}</DialogDescription></div>
        {editingSelected ? <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
          <ContactEditorFields draft={draft} members={members.data ?? []} onChange={setDraft} />
          {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
          <div className="flex flex-wrap gap-3"><Button type="submit" variant="ink" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save changes"}</Button><Button type="button" variant="outlineInk" disabled={save.isPending} onClick={() => { setEditingSelected(false); setDraft(blank); setSaveError(""); }}>Cancel</Button></div>
        </form> : <>
          <dl className="grid gap-4 rounded-xl border border-border/60 p-4 sm:grid-cols-2">
            <ContactValue label="First name" value={selectedContact.first_name} /><ContactValue label="Last name" value={selectedContact.last_name} /><ContactValue label="Email" value={selectedContact.email} /><ContactValue label="Phone" value={selectedContact.phone} /><ContactValue label="Company" value={selectedContact.company} /><ContactValue label="Source" value={selectedContact.source} />
            <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">LinkedIn URL</dt><dd className="mt-1 break-all">{selectedContact.linkedin_url ? <a href={selectedContact.linkedin_url} target="_blank" rel="noreferrer" className="underline">{selectedContact.linkedin_url}</a> : "—"}</dd></div>
            <ContactValue label="Birth year" value={selectedContact.birth_year?.toString() ?? null} /><ContactValue label="Newsletter status" value={selectedContact.newsletter_status} /><ContactValue label="Consent recorded" value={selectedContact.consent_at ? new Date(selectedContact.consent_at).toLocaleString("en-GB") : "No recorded consent"} /><ContactValue label="Linked member" value={selectedContact.member_id ? selectedMember ? `${[selectedMember.first_name, selectedMember.last_name].filter(Boolean).join(" ") || "Member"} · ${selectedMember.email ?? ""}` : "Linked member record" : "No linked member"} /><ContactValue label="Created" value={new Date(selectedContact.created_at).toLocaleString("en-GB")} /><ContactValue label="Last updated" value={new Date(selectedContact.updated_at).toLocaleString("en-GB")} />
            <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wider text-muted-foreground">Notes</dt><dd className="mt-1 whitespace-pre-wrap">{selectedContact.notes || "—"}</dd></div>
          </dl>
          {selectedContact.archived_at && <p className="rounded-lg bg-muted p-3 text-sm">Archived on {new Date(selectedContact.archived_at).toLocaleDateString("en-GB")}. The record and its history are preserved.</p>}
          <div className="space-y-3 rounded-xl border border-border/60 p-4"><h3 className="font-semibold">Segments</h3><p className="text-xs text-muted-foreground">These labels can be combined. They do not change newsletter consent.</p><div className="flex flex-wrap gap-2">{selectedContactSegments.length ? selectedContactSegments.map((segment) => <span key={segment.id} className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1 text-sm">{segment.name}{segment.archived_at && " (archived)"}<button type="button" className="underline" disabled={bulkUpdateContacts.isPending || selectedContact.archived_at !== null} onClick={() => { if (window.confirm(`Remove “${segment.name}” from this contact?`)) bulkUpdateContacts.mutate({ action: "segment_remove", contactIds: [selectedContact.id], segmentId: segment.id }); }}>Remove</button></span>) : <span className="text-sm text-muted-foreground">No segments assigned</span>}</div>{selectedContact.archived_at === null && <div className="flex flex-wrap gap-2"><select aria-label="Add segment to contact" className={`${inputClass} max-w-64`} value={profileSegmentId} onChange={(event) => setProfileSegmentId(event.target.value)}><option value="">Choose a segment…</option>{availableProfileSegments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}</select><Button type="button" variant="outlineInk" disabled={!profileSegmentId || bulkUpdateContacts.isPending} onClick={() => bulkUpdateContacts.mutate({ action: "segment_assign", contactIds: [selectedContact.id], segmentId: profileSegmentId })}>Add segment</Button></div>}</div>
          <div className="flex flex-wrap gap-3"><Button type="button" variant="ink" disabled={selectedContact.archived_at !== null || members.isLoading} onClick={() => startEditingContact(selectedContact)}>Edit contact</Button>{selectedContact.archived_at ? <Button type="button" variant="outlineInk" disabled={restoreMutation.isPending} onClick={() => restoreMutation.mutate(selectedContact.id)}>{restoreMutation.isPending ? "Restoring…" : "Restore contact"}</Button> : <Button type="button" variant="outlineInk" disabled={archiveMutation.isPending} onClick={() => confirmArchive(selectedContact)}>{archiveMutation.isPending ? "Archiving…" : "Archive contact"}</Button>}<Button type="button" variant="outlineInk" onClick={() => { setSelectedContactId(null); setEditingSelected(false); }}>Close</Button></div>
          <p className="text-xs leading-relaxed text-muted-foreground">Archiving preserves this contact and all linked order, ticket, payment, membership and registration history. Permanent deletion is not available here.</p>
        </>}
      </DialogContent>
    </Dialog>}
  </AdminPage>;
}

function ContactEditorFields({ draft, members, onChange }: { draft: ContactDraft; members: MemberOption[]; onChange: (draft: ContactDraft) => void }) {
  return <>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Email" hint="Saved in lowercase with surrounding spaces removed."><input required type="email" maxLength={320} className={inputClass} autoComplete="email" value={draft.email} onChange={(event) => onChange({ ...draft, email: event.target.value })} /></Field>
      <Field label="Source"><input required minLength={2} maxLength={80} className={inputClass} value={draft.source} onChange={(event) => onChange({ ...draft, source: event.target.value })} /></Field>
      <Field label="First name"><input maxLength={120} className={inputClass} autoComplete="given-name" value={draft.first_name} onChange={(event) => onChange({ ...draft, first_name: event.target.value })} /></Field>
      <Field label="Last name"><input maxLength={120} className={inputClass} autoComplete="family-name" value={draft.last_name} onChange={(event) => onChange({ ...draft, last_name: event.target.value })} /></Field>
      <Field label="Phone"><input type="tel" maxLength={80} className={inputClass} autoComplete="tel" value={draft.phone} onChange={(event) => onChange({ ...draft, phone: event.target.value })} /></Field>
      <Field label="Company"><input maxLength={160} className={inputClass} autoComplete="organization" value={draft.company} onChange={(event) => onChange({ ...draft, company: event.target.value })} /></Field>
      <Field label="LinkedIn URL" hint="Optional. Use an HTTPS LinkedIn profile or company URL."><input type="url" maxLength={2048} placeholder="https://www.linkedin.com/in/..." className={inputClass} value={draft.linkedin_url} onChange={(event) => onChange({ ...draft, linkedin_url: event.target.value })} /></Field>
      <Field label="Birth year" hint={`Optional. Enter a year from 1900 to ${new Date().getFullYear()}.`}><input type="number" inputMode="numeric" min={1900} max={new Date().getFullYear()} step={1} className={inputClass} value={draft.birth_year} onChange={(event) => onChange({ ...draft, birth_year: event.target.value })} /></Field>
      <Field label="Newsletter consent"><select className={inputClass} value={draft.newsletter_status} onChange={(event) => onChange({ ...draft, newsletter_status: event.target.value as ContactDraft["newsletter_status"] })}><option value="pending">Pending</option><option value="subscribed">Subscribed</option><option value="unsubscribed">Unsubscribed</option></select><span className="block text-xs text-muted-foreground">Only mark as subscribed when consent has been recorded.</span></Field>
      <Field label="Link to member"><select className={inputClass} value={draft.member_id} onChange={(event) => onChange({ ...draft, member_id: event.target.value })}><option value="">No linked member</option>{members.map((member) => <option key={member.id} value={member.id}>{[member.first_name, member.last_name].filter(Boolean).join(" ") || member.email} · {member.email}</option>)}</select></Field>
    </div>
    <Field label="Notes"><textarea maxLength={5000} className={textareaClass} value={draft.notes} onChange={(event) => onChange({ ...draft, notes: event.target.value })} /></Field>
  </>;
}

function ContactValue({ label, value }: { label: string; value: string | null }) {
  return <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt><dd className="mt-1 break-words">{value || "—"}</dd></div>;
}
