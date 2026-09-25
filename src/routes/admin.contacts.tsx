import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminListContacts, adminListMemberOptions, adminSaveContact } from "@/lib/admin.functions";
import { AdminPage, AdminTable, Field, inputClass, textareaClass } from "@/components/admin/AdminBits";
import { Button } from "@/components/ui/button";
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from "@/components/site/Bits";

export const Route = createFileRoute("/admin/contacts")({ component: ContactsPage });

type ContactDraft = { id?: string; email: string; first_name: string; last_name: string; phone: string; company: string; source: string; newsletter_status: "subscribed" | "unsubscribed" | "pending"; member_id: string; notes: string };
const blank: ContactDraft = { email: "", first_name: "", last_name: "", phone: "", company: "", source: "manual", newsletter_status: "pending", member_id: "", notes: "" };

function ContactsPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "subscribed" | "unsubscribed" | "pending">("all");
  const [draft, setDraft] = useState<ContactDraft>(blank);
  const fetchContacts = useServerFn(adminListContacts);
  const fetchMembers = useServerFn(adminListMemberOptions);
  const saveContact = useServerFn(adminSaveContact);
  const cache = useQueryClient();
  const contacts = useQuery({ queryKey: ["admin", "contacts", query, status], queryFn: () => fetchContacts({ data: { query, status } }) });
  const members = useQuery({ queryKey: ["admin", "member-options"], queryFn: () => fetchMembers() });
  const save = useMutation({
    mutationFn: () => saveContact({ data: { ...draft, first_name: draft.first_name || null, last_name: draft.last_name || null, phone: draft.phone || null, company: draft.company || null, notes: draft.notes || null, member_id: draft.member_id || null } }),
    onSuccess: () => { toast.success("Contact saved"); setDraft(blank); cache.invalidateQueries({ queryKey: ["admin", "contacts"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  function exportContacts() {
    const rows = contacts.data ?? [];
    const values = ["email", "first_name", "last_name", "company", "source", "newsletter_status", "member_id"].map((key) => key).join(",") + "\n" + rows.map((contact) => [contact.email, contact.first_name, contact.last_name, contact.company, contact.source, contact.newsletter_status, contact.member_id].map((value) => `\"${String(value ?? "").replaceAll("\"", "\"\"")}\"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([values], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "cometx-contacts.csv"; link.click(); URL.revokeObjectURL(url);
  }

  return <AdminPage title="Contacts" description="Newsletter and event leads. Contacts stay separate from authenticated members." action={<Button onClick={() => document.getElementById("new-contact")?.scrollIntoView({ behavior: "smooth" })} variant="ink">New contact</Button>}>
    <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
      <input className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email or company" />
      <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">All newsletter states</option><option value="subscribed">Subscribed</option><option value="pending">Pending</option><option value="unsubscribed">Unsubscribed</option></select>
      <Button type="button" variant="outlineInk" onClick={exportContacts} disabled={!contacts.data?.length}>Export CSV</Button>
    </div>
    {contacts.isLoading && <LoadingBlock label="Loading contacts" />}
    {contacts.error && <ErrorBlock error={contacts.error} />}
    {contacts.data?.length === 0 && <EmptyBlock title="No contacts found" />}
    {contacts.data && contacts.data.length > 0 && <AdminTable head={["Contact", "Company", "Source", "Newsletter", "Linked member", "Added", ""]}>{contacts.data.map((contact) => <tr key={contact.id} className="[&>td]:px-4 [&>td]:py-3"><td><p className="font-medium">{[contact.first_name, contact.last_name].filter(Boolean).join(" ") || "-"}</p><p className="text-xs text-muted-foreground">{contact.email}</p></td><td>{contact.company ?? "-"}</td><td>{contact.source}</td><td><StatusPill tone={contact.newsletter_status === "subscribed" ? "success" : "muted"}>{contact.newsletter_status}</StatusPill></td><td>{contact.member_id ? "Linked" : "-"}</td><td>{new Date(contact.created_at).toLocaleDateString("en-GB")}</td><td><button className="text-xs underline" onClick={() => { setDraft({ id: contact.id, email: contact.email, first_name: contact.first_name ?? "", last_name: contact.last_name ?? "", phone: contact.phone ?? "", company: contact.company ?? "", source: contact.source, newsletter_status: contact.newsletter_status, member_id: contact.member_id ?? "", notes: contact.notes ?? "" }); document.getElementById("new-contact")?.scrollIntoView({ behavior: "smooth" }); }}>Edit</button></td></tr>)}</AdminTable>}
    <form id="new-contact" className="mt-10 space-y-5 rounded-2xl border border-border/60 bg-card p-6" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <h2 className="font-display text-lg font-bold">{draft.id ? "Edit contact" : "Add contact"}</h2>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Email"><input required type="email" className={inputClass} value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></Field><Field label="Source"><input required className={inputClass} value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })} /></Field><Field label="First name"><input className={inputClass} value={draft.first_name} onChange={(event) => setDraft({ ...draft, first_name: event.target.value })} /></Field><Field label="Last name"><input className={inputClass} value={draft.last_name} onChange={(event) => setDraft({ ...draft, last_name: event.target.value })} /></Field><Field label="Company"><input className={inputClass} value={draft.company} onChange={(event) => setDraft({ ...draft, company: event.target.value })} /></Field><Field label="Newsletter"><select className={inputClass} value={draft.newsletter_status} onChange={(event) => setDraft({ ...draft, newsletter_status: event.target.value as typeof draft.newsletter_status })}><option value="pending">Pending</option><option value="subscribed">Subscribed</option><option value="unsubscribed">Unsubscribed</option></select></Field><Field label="Link to member"><select className={inputClass} value={draft.member_id} onChange={(event) => setDraft({ ...draft, member_id: event.target.value })}><option value="">No linked member</option>{members.data?.map((member) => <option key={member.id} value={member.id}>{[member.first_name, member.last_name].filter(Boolean).join(" ") || member.email} · {member.email}</option>)}</select></Field></div>
      <Field label="Notes"><textarea className={textareaClass} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></Field><div className="flex gap-3"><Button type="submit" variant="ink" disabled={save.isPending}>{save.isPending ? "Saving..." : "Save contact"}</Button>{draft.id && <Button type="button" variant="outlineInk" onClick={() => setDraft(blank)}>New contact</Button>}</div>
    </form>
  </AdminPage>;
}
