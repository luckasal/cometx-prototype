import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminListSpeakers, adminSaveSpeaker, adminDeleteSpeaker } from "@/lib/admin.functions";
import { AdminPage, AdminTable, Field, inputClass, textareaClass } from "@/components/admin/AdminBits";
import { ErrorBlock, LoadingBlock } from "@/components/site/Bits";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/speakers")({
  component: AdminSpeakersPage,
});

type SpeakerForm = {
  id?: string;
  name: string;
  slug: string;
  job_title: string;
  company: string;
  bio: string;
  photo_url: string;
};

const empty: SpeakerForm = {
  name: "",
  slug: "",
  job_title: "",
  company: "",
  bio: "",
  photo_url: "",
};

const nullable = (v: string) => (v.trim() === "" ? null : v.trim());

function AdminSpeakersPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SpeakerForm>(empty);

  const fetchSpeakers = useServerFn(adminListSpeakers);
  const saveSpeaker = useServerFn(adminSaveSpeaker);
  const deleteSpeaker = useServerFn(adminDeleteSpeaker);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "speakers"],
    queryFn: () => fetchSpeakers(),
  });

  const save = useMutation({
    mutationFn: () =>
      saveSpeaker({
        data: {
          ...(form.id ? { id: form.id } : {}),
          name: form.name.trim(),
          slug: form.slug.trim(),
          job_title: nullable(form.job_title),
          company: nullable(form.company),
          bio: nullable(form.bio),
          photo_url: nullable(form.photo_url),
          linkedin_url: null,
          website_url: null,
        } as never,
      }),
    onSuccess: () => {
      toast.success("Speaker saved");
      setForm(empty);
      queryClient.invalidateQueries({ queryKey: ["admin", "speakers"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteSpeaker({ data: { id } }),
    onSuccess: () => {
      toast.success("Speaker deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "speakers"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function set<K extends keyof SpeakerForm>(key: K, value: SpeakerForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <AdminPage title="Speakers" description="People who appear on stage or lead a workshop.">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          {isLoading && <LoadingBlock label="Loading speakers" />}
          {error && <ErrorBlock error={error} />}
          {data && (
            <AdminTable head={["Name", "Role", ""]}>
              {data.map((speaker) => (
                <tr key={speaker.id} className="[&>td]:px-4 [&>td]:py-3">
                  <td className="font-medium">{speaker.name}</td>
                  <td className="text-muted-foreground">
                    {speaker.job_title}
                    {speaker.company ? `, ${speaker.company}` : ""}
                  </td>
                  <td className="space-x-4 text-right">
                    <button
                      className="text-xs underline underline-offset-4"
                      onClick={() =>
                        setForm({
                          id: speaker.id,
                          name: speaker.name,
                          slug: speaker.slug,
                          job_title: speaker.job_title ?? "",
                          company: speaker.company ?? "",
                          bio: speaker.bio ?? "",
                          photo_url: speaker.photo_url ?? "",
                        })
                      }
                    >
                      Edit
                    </button>
                    <button
                      className="text-xs text-destructive underline underline-offset-4"
                      onClick={() => {
                        if (confirm(`Delete ${speaker.name}?`)) remove.mutate(speaker.id);
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
          className="space-y-5 border border-border bg-card p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.name.trim() || !form.slug.trim()) {
              toast.error("Name and slug are required.");
              return;
            }
            save.mutate();
          }}
        >
          <h2 className="font-display text-lg font-bold">
            {form.id ? "Edit speaker" : "Add speaker"}
          </h2>
          <Field label="Name">
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => {
                set("name", e.target.value);
                if (!form.id)
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
            <input className={inputClass} value={form.slug} onChange={(e) => set("slug", e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Job title">
              <input
                className={inputClass}
                value={form.job_title}
                onChange={(e) => set("job_title", e.target.value)}
              />
            </Field>
            <Field label="Company">
              <input
                className={inputClass}
                value={form.company}
                onChange={(e) => set("company", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Bio">
            <textarea
              className={textareaClass}
              value={form.bio}
              onChange={(e) => set("bio", e.target.value)}
            />
          </Field>
          <Field label="Photo URL">
            <input
              className={inputClass}
              value={form.photo_url}
              onChange={(e) => set("photo_url", e.target.value)}
            />
          </Field>
          <div className="flex gap-3">
            <Button type="submit" variant="ink" disabled={save.isPending}>
              {save.isPending ? "Saving..." : "Save speaker"}
            </Button>
            {form.id && (
              <Button type="button" variant="outlineInk" onClick={() => setForm(empty)}>
                New speaker
              </Button>
            )}
          </div>
        </form>
      </div>
    </AdminPage>
  );
}
