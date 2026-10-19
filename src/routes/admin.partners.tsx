import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminDeletePartner, adminListPartners, adminSavePartner } from "@/lib/admin.functions";
import { AdminPage, AdminTable, Field, inputClass, textareaClass } from "@/components/admin/AdminBits";
import { Button } from "@/components/ui/button";
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from "@/components/site/Bits";

export const Route = createFileRoute("/admin/partners")({ component: AdminPartnersPage });
type PartnerForm = { id?: string; name: string; tier: string; website_url: string; logo_url: string; description: string; active: boolean };
const empty: PartnerForm = { name: "", tier: "", website_url: "", logo_url: "", description: "", active: true };
const nullable = (value: string) => value.trim() || null;

function AdminPartnersPage() {
  const [form, setForm] = useState<PartnerForm>(empty);
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState("");
  const [visibility, setVisibility] = useState<"all" | "active" | "hidden">("all");
  const cache = useQueryClient();
  const fetchPartners = useServerFn(adminListPartners); const savePartner = useServerFn(adminSavePartner); const deletePartner = useServerFn(adminDeletePartner);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin", "partners"], queryFn: () => fetchPartners() });
  const save = useMutation({ mutationFn: () => savePartner({ data: { ...(form.id ? { id: form.id } : {}), name: form.name.trim(), tier: nullable(form.tier), website_url: nullable(form.website_url), logo_url: nullable(form.logo_url), description: nullable(form.description), active: form.active } }), onSuccess: () => { toast.success("Partner saved"); setForm(empty); cache.invalidateQueries({ queryKey: ["admin", "partners"] }); cache.invalidateQueries({ queryKey: ["partners"] }); }, onError: (error: Error) => toast.error(error.message) });
  const remove = useMutation({ mutationFn: (id: string) => deletePartner({ data: { id } }), onSuccess: () => { toast.success("Partner deleted"); cache.invalidateQueries({ queryKey: ["admin", "partners"] }); cache.invalidateQueries({ queryKey: ["partners"] }); }, onError: (error: Error) => toast.error(error.message) });
  const partners = data ?? [];
  const tiers = Array.from(new Set(partners.map((partner) => partner.tier?.trim()).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b));
  const term = search.trim().toLocaleLowerCase();
  const filteredPartners = partners.filter((partner) => {
    const matchesSearch = !term || [partner.name, partner.website_url, partner.description].some((value) => value?.toLocaleLowerCase().includes(term));
    const matchesTier = !tier || partner.tier?.trim() === tier;
    const matchesVisibility = visibility === "all" || partner.active === (visibility === "active");
    return matchesSearch && matchesTier && matchesVisibility;
  });
  const hasFilters = Boolean(term || tier || visibility !== "all");
  const clearFilters = () => { setSearch(""); setTier(""); setVisibility("all"); };
  return <AdminPage title="Partners" description="Companies and organisations supporting CometX events.">
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]"><div className="space-y-4">
      {!isLoading && !error && partners.length > 0 && <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-sm">Search partners<input className={inputClass} type="search" placeholder="Name, website or description" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <label className="space-y-1 text-sm">Tier<select className={inputClass} value={tier} onChange={(event) => setTier(event.target.value)}><option value="">All tiers</option>{tiers.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="space-y-1 text-sm">Visibility<select className={inputClass} value={visibility} onChange={(event) => setVisibility(event.target.value as "all" | "active" | "hidden")}><option value="all">All partners</option><option value="active">Visible publicly</option><option value="hidden">Hidden</option></select></label>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground"><span>Showing {filteredPartners.length} of {partners.length} partners</span>{hasFilters && <button type="button" className="underline" onClick={clearFilters}>Clear filters</button>}</div>
      </div>}
      {isLoading && <LoadingBlock label="Loading partners" />}
      {error && <ErrorBlock error={error} />}
      {data?.length === 0 && <EmptyBlock title="No partners yet" />}
      {data && data.length > 0 && filteredPartners.length === 0 && <EmptyBlock title="No partners match these filters" />}
      {filteredPartners.length > 0 && <AdminTable head={["Name", "Tier", "Status", ""]}>{filteredPartners.map((partner) => <tr key={partner.id} className="[&>td]:px-4 [&>td]:py-3"><td><p className="font-medium">{partner.name}</p><p className="text-xs text-muted-foreground">{partner.website_url ?? ""}</p></td><td>{partner.tier ?? "-"}</td><td><StatusPill tone={partner.active ? "success" : "muted"}>{partner.active ? "Active" : "Hidden"}</StatusPill></td><td className="space-x-3 text-right"><button className="text-xs underline" onClick={() => setForm({ id: partner.id, name: partner.name, tier: partner.tier ?? "", website_url: partner.website_url ?? "", logo_url: partner.logo_url ?? "", description: partner.description ?? "", active: partner.active })}>Edit</button><button className="text-xs text-destructive underline" onClick={() => { if (confirm(`Delete ${partner.name}?`)) remove.mutate(partner.id); }}>Delete</button></td></tr>)}</AdminTable>}
    </div>
      <form className="space-y-5 rounded-2xl border border-border/60 bg-card p-6" onSubmit={(event) => { event.preventDefault(); if (!form.name.trim()) { toast.error("Partner name is required."); return; } save.mutate(); }}><h2 className="font-display text-lg font-bold">{form.id ? "Edit partner" : "Add partner"}</h2><Field label="Name"><input className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Tier"><input className={inputClass} value={form.tier} onChange={(event) => setForm({ ...form, tier: event.target.value })} /></Field><Field label="Website"><input type="url" className={inputClass} value={form.website_url} onChange={(event) => setForm({ ...form, website_url: event.target.value })} /></Field></div><Field label="Logo URL"><input type="url" className={inputClass} value={form.logo_url} onChange={(event) => setForm({ ...form, logo_url: event.target.value })} /></Field><Field label="Description"><textarea className={textareaClass} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />Visible publicly</label><div className="flex gap-3"><Button type="submit" variant="ink" disabled={save.isPending}>{save.isPending ? "Saving..." : "Save partner"}</Button>{form.id && <Button type="button" variant="outlineInk" onClick={() => setForm(empty)}>New partner</Button>}</div></form>
    </div>
  </AdminPage>;
}
