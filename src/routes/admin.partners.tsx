import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminDeletePartner, adminListPartners, adminSavePartner } from "@/lib/admin.functions";
import { uploadPartnerLogo } from "@/lib/event-media";
import { eventImageIssue } from "@/lib/event-media-rules";
import {
  AdminPage,
  AdminTable,
  Field,
  inputClass,
  textareaClass,
} from "@/components/admin/AdminBits";
import { Button } from "@/components/ui/button";
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from "@/components/site/Bits";

export const Route = createFileRoute("/admin/partners")({ component: AdminPartnersPage });

type PartnerForm = {
  id?: string;
  name: string;
  tier: string;
  sector: string;
  collaboration_start_date: string;
  collaboration_end_date: string;
  website_url: string;
  logo_url: string;
  description: string;
  description_en: string;
  active: boolean;
};

const empty: PartnerForm = {
  name: "",
  tier: "",
  sector: "",
  collaboration_start_date: "",
  collaboration_end_date: "",
  website_url: "",
  logo_url: "",
  description: "",
  description_en: "",
  active: true,
};

const nullable = (value: string) => value.trim() || null;

function AdminPartnersPage() {
  const [form, setForm] = useState<PartnerForm>(empty);
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const cache = useQueryClient();
  const fetchPartners = useServerFn(adminListPartners);
  const savePartner = useServerFn(adminSavePartner);
  const deletePartner = useServerFn(adminDeletePartner);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "partners"],
    queryFn: () => fetchPartners(),
  });

  const choices = useMemo(() => {
    const all = data ?? [];
    return {
      tiers: [
        ...new Set(
          all.map((partner) => partner.tier).filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
      sectors: [
        ...new Set(
          all.map((partner) => partner.sector).filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    };
  }, [data]);

  const visiblePartners = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return (data ?? []).filter((partner) => {
      const matchesTerm =
        !term ||
        [partner.name, partner.tier, partner.sector, partner.website_url].some((value) =>
          value?.toLocaleLowerCase().includes(term),
        );
      return (
        matchesTerm &&
        (tierFilter === "all" || partner.tier === tierFilter) &&
        (sectorFilter === "all" || partner.sector === sectorFilter) &&
        (statusFilter === "all" || (statusFilter === "active" ? partner.active : !partner.active))
      );
    });
  }, [data, query, sectorFilter, statusFilter, tierFilter]);

  const save = useMutation({
    mutationFn: () =>
      savePartner({
        data: {
          ...(form.id ? { id: form.id } : {}),
          name: form.name.trim(),
          tier: nullable(form.tier),
          sector: nullable(form.sector),
          collaboration_start_date: nullable(form.collaboration_start_date),
          collaboration_end_date: nullable(form.collaboration_end_date),
          website_url: nullable(form.website_url),
          logo_url: nullable(form.logo_url),
          description: nullable(form.description),
          description_en: nullable(form.description_en),
          active: form.active,
        },
      }),
    onSuccess: () => {
      toast.success("Partner saved");
      setForm(empty);
      cache.invalidateQueries({ queryKey: ["admin", "partners"] });
      cache.invalidateQueries({ queryKey: ["partners"] });
    },
    onError: (cause: Error) => toast.error(cause.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deletePartner({ data: { id } }),
    onSuccess: (_result, id) => {
      toast.success("Partner deleted");
      if (form.id === id) setForm(empty);
      cache.invalidateQueries({ queryKey: ["admin", "partners"] });
      cache.invalidateQueries({ queryKey: ["partners"] });
    },
    onError: (cause: Error) => toast.error(cause.message),
  });

  async function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const issue = eventImageIssue(file);
    if (issue) {
      setUploadError(issue);
      input.value = "";
      return;
    }
    setUploadingLogo(true);
    setUploadError(null);
    try {
      const url = await uploadPartnerLogo(file);
      setForm((current) => ({ ...current, logo_url: url }));
      toast.success("Logo uploaded. Save the partner to publish it.");
    } catch (cause) {
      setUploadError(cause instanceof Error ? cause.message : "The logo could not be uploaded.");
    } finally {
      setUploadingLogo(false);
      input.value = "";
    }
  }

  return (
    <AdminPage
      title="Partners"
      description="Manage public partner profiles and internal collaboration details."
    >
      <div className="space-y-6">
        <section
          className="rounded-2xl border border-border/60 bg-card p-5"
          aria-label="Filter partners"
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Search partners">
              <input
                className={inputClass}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, sector, tier or website"
              />
            </Field>
            <Field label="Tier">
              <select
                className={inputClass}
                value={tierFilter}
                onChange={(event) => setTierFilter(event.target.value)}
              >
                <option value="all">All tiers</option>
                {choices.tiers.map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sector">
              <select
                className={inputClass}
                value={sectorFilter}
                onChange={(event) => setSectorFilter(event.target.value)}
              >
                <option value="all">All sectors</option>
                {choices.sectors.map((sector) => (
                  <option key={sector} value={sector}>
                    {sector}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Visibility">
              <select
                className={inputClass}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All partners</option>
                <option value="active">Public</option>
                <option value="hidden">Hidden</option>
              </select>
            </Field>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Showing {visiblePartners.length} of {data?.length ?? 0} partners.
          </p>
        </section>

        <div className="grid items-start gap-8 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="min-w-0 space-y-3">
            {isLoading && <LoadingBlock label="Loading partners" />}
            {error && <ErrorBlock error={error} />}
            {data?.length === 0 && <EmptyBlock title="No partners yet" />}
            {data && data.length > 0 && visiblePartners.length === 0 && (
              <EmptyBlock title="No partners match these filters" />
            )}
            {visiblePartners.length > 0 && (
              <AdminTable head={["Partner", "Tier / sector", "Collaboration", "Status", "Actions"]}>
                {visiblePartners.map((partner) => (
                  <tr key={partner.id} className="[&>td]:px-4 [&>td]:py-3">
                    <td>
                      <div className="flex items-center gap-3">
                        {partner.logo_url ? (
                          <img
                            src={partner.logo_url}
                            alt=""
                            className="h-10 w-10 rounded-lg bg-white object-contain p-1"
                          />
                        ) : (
                          <div
                            aria-hidden="true"
                            className="h-10 w-10 rounded-lg border border-border/60"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium">{partner.name}</p>
                          <p className="max-w-52 truncate text-xs text-muted-foreground">
                            {partner.website_url ?? ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      {partner.tier || "-"}
                      <p className="text-xs text-muted-foreground">
                        {partner.sector || "No sector"}
                      </p>
                    </td>
                    <td className="text-sm">
                      {partner.collaboration_start_date || "-"}
                      <span className="px-1 text-muted-foreground">→</span>
                      {partner.collaboration_end_date || "Ongoing"}
                    </td>
                    <td>
                      <StatusPill tone={partner.active ? "success" : "muted"}>
                        {partner.active ? "Public" : "Hidden"}
                      </StatusPill>
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <button
                        className="mr-3 text-xs underline"
                        onClick={() =>
                          setForm({
                            id: partner.id,
                            name: partner.name,
                            tier: partner.tier ?? "",
                            sector: partner.sector ?? "",
                            collaboration_start_date: partner.collaboration_start_date ?? "",
                            collaboration_end_date: partner.collaboration_end_date ?? "",
                            website_url: partner.website_url ?? "",
                            logo_url: partner.logo_url ?? "",
                            description: partner.description ?? "",
                            description_en: partner.description_en ?? "",
                            active: partner.active,
                          })
                        }
                      >
                        Edit
                      </button>
                      <button
                        className="text-xs text-destructive underline"
                        onClick={() => {
                          if (confirm(`Delete ${partner.name}? This also removes its event links.`))
                            remove.mutate(partner.id);
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </AdminTable>
            )}
          </div>

          <form
            className="space-y-5 rounded-2xl border border-border/60 bg-card p-6"
            onSubmit={(event) => {
              event.preventDefault();
              if (!form.name.trim()) {
                toast.error("Partner name is required.");
                return;
              }
              if (
                form.collaboration_start_date &&
                form.collaboration_end_date &&
                form.collaboration_end_date < form.collaboration_start_date
              ) {
                toast.error("The collaboration end date must be on or after the start date.");
                return;
              }
              save.mutate();
            }}
          >
            <div>
              <h2 className="font-display text-lg font-bold">
                {form.id ? "Edit partner" : "Add partner"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Public fields appear on the website; sector and dates are for internal tracking.
              </p>
            </div>
            <Field label="Name">
              <input
                required
                minLength={2}
                className={inputClass}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tier">
                <input
                  className={inputClass}
                  value={form.tier}
                  onChange={(event) => setForm({ ...form, tier: event.target.value })}
                />
              </Field>
              <Field label="Sector (internal)">
                <input
                  className={inputClass}
                  value={form.sector}
                  onChange={(event) => setForm({ ...form, sector: event.target.value })}
                  placeholder="e.g. Finance, education"
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Collaboration start">
                <input
                  type="date"
                  className={inputClass}
                  value={form.collaboration_start_date}
                  onChange={(event) =>
                    setForm({ ...form, collaboration_start_date: event.target.value })
                  }
                />
              </Field>
              <Field label="Collaboration end">
                <input
                  type="date"
                  className={inputClass}
                  value={form.collaboration_end_date}
                  onChange={(event) =>
                    setForm({ ...form, collaboration_end_date: event.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="Website">
              <input
                type="url"
                className={inputClass}
                value={form.website_url}
                onChange={(event) => setForm({ ...form, website_url: event.target.value })}
                placeholder="https://…"
              />
            </Field>
            <Field label="Partner logo">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploadingLogo}
                onChange={handleLogoUpload}
                className="block w-full text-sm file:mr-3 file:rounded-full file:border file:border-accent file:bg-transparent file:px-4 file:py-2 file:text-accent"
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                Upload from your computer: JPEG, PNG or WebP, up to 5 MB. Save the partner after
                upload.
              </span>
            </Field>
            {uploadingLogo && (
              <p role="status" className="text-sm">
                Uploading logo…
              </p>
            )}
            {uploadError && (
              <p role="alert" className="text-sm text-destructive">
                {uploadError}
              </p>
            )}
            {form.logo_url && (
              <div className="flex items-center gap-3 rounded-xl border border-border/60 p-3">
                <img
                  src={form.logo_url}
                  alt="Partner logo preview"
                  className="h-16 w-16 rounded-lg bg-white object-contain p-2"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Logo preview</p>
                  <button
                    type="button"
                    className="mt-1 text-xs underline"
                    onClick={() => setForm({ ...form, logo_url: "" })}
                  >
                    Remove logo from partner
                  </button>
                </div>
              </div>
            )}
            <Field label="Description (CZ)">
              <textarea
                className={textareaClass}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                Shown on the public Partners page. Event pages currently show linked partner names
                only.
              </span>
            </Field>
            <Field label="Description (EN)">
              <textarea className={textareaClass} value={form.description_en} onChange={(event) => setForm({ ...form, description_en: event.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm({ ...form, active: event.target.checked })}
              />
              Visible publicly
            </label>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" variant="ink" disabled={save.isPending || uploadingLogo}>
                {save.isPending ? "Saving…" : "Save partner"}
              </Button>
              {form.id && (
                <Button
                  type="button"
                  variant="outlineInk"
                  onClick={() => {
                    setForm(empty);
                    setUploadError(null);
                  }}
                >
                  Cancel edit
                </Button>
              )}
              {!form.id && (
                <Button
                  type="button"
                  variant="outlineInk"
                  onClick={() => {
                    setForm(empty);
                    setUploadError(null);
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Uploaded files are not automatically deleted if you cancel or replace a logo. Remove
              the reference here; ask an administrator to clean up unused files.
            </p>
          </form>
        </div>
      </div>
    </AdminPage>
  );
}
