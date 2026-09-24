import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { adminSaveArticle, adminListEntitlements } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Field, inputClass, textareaClass } from "@/components/admin/AdminBits";

export type ArticleFormValues = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  hero_image_url: string;
  status: string;
  visibility: string;
  required_entitlement: string;
};

export const emptyArticle: ArticleFormValues = {
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  hero_image_url: "",
  status: "draft",
  visibility: "public",
  required_entitlement: "",
};

const nullable = (value: string) => (value.trim() === "" ? null : value.trim());

export function ArticleForm({ initial }: { initial: ArticleFormValues }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(initial);

  const save = useServerFn(adminSaveArticle);
  const fetchEntitlements = useServerFn(adminListEntitlements);
  const { data: entitlements = [] } = useQuery({
    queryKey: ["admin", "entitlements"],
    queryFn: () => fetchEntitlements(),
  });

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          ...(form.id ? { id: form.id } : {}),
          title: form.title.trim(),
          slug: form.slug.trim(),
          excerpt: nullable(form.excerpt),
          body: nullable(form.body),
          hero_image_url: nullable(form.hero_image_url),
          status: form.status,
          visibility: form.visibility,
          required_entitlement:
            form.visibility === "entitlement" ? nullable(form.required_entitlement) : null,
          published_at: null,
        } as never,
      }),
    onSuccess: () => {
      toast.success("Article saved");
      queryClient.invalidateQueries({ queryKey: ["admin", "articles"] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      navigate({ to: "/admin/articles" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function set<K extends keyof ArticleFormValues>(key: K, value: ArticleFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form
      className="max-w-3xl space-y-6 border border-border bg-card p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.title.trim() || !form.slug.trim()) {
          toast.error("Title and slug are required.");
          return;
        }
        mutation.mutate();
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Title">
          <input
            className={inputClass}
            value={form.title}
            onChange={(e) => {
              set("title", e.target.value);
              if (!form.id && !initial.slug)
                set(
                  "slug",
                  e.target.value
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, ""),
                );
            }}
          />
        </Field>
        <Field label="Slug">
          <input
            className={inputClass}
            value={form.slug}
            onChange={(e) => set("slug", e.target.value)}
          />
        </Field>
      </div>
      <Field label="Excerpt">
        <input
          className={inputClass}
          value={form.excerpt}
          onChange={(e) => set("excerpt", e.target.value)}
        />
      </Field>
      <Field label="Body">
        <textarea
          className={textareaClass}
          rows={14}
          value={form.body}
          onChange={(e) => set("body", e.target.value)}
        />
      </Field>
      <Field label="Hero image URL">
        <input
          className={inputClass}
          value={form.hero_image_url}
          onChange={(e) => set("hero_image_url", e.target.value)}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Status">
          <select
            className={inputClass}
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
          >
            <option value="draft">draft</option>
            <option value="published">published</option>
          </select>
        </Field>
        <Field label="Visibility">
          <select
            className={inputClass}
            value={form.visibility}
            onChange={(e) => set("visibility", e.target.value)}
          >
            <option value="public">public</option>
            <option value="registered">registered users</option>
            <option value="members">members</option>
            <option value="entitlement">specific entitlement</option>
          </select>
        </Field>
        <Field label="Required entitlement">
          <select
            className={inputClass}
            value={form.required_entitlement}
            disabled={form.visibility !== "entitlement"}
            onChange={(e) => set("required_entitlement", e.target.value)}
          >
            <option value="">None</option>
            {entitlements.map((ent) => (
              <option key={ent.key} value={ent.key}>
                {ent.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex gap-3">
        <Button type="submit" variant="ink" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save article"}
        </Button>
        <Button
          type="button"
          variant="outlineInk"
          onClick={() => navigate({ to: "/admin/articles" })}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
