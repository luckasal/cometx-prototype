import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminDeleteEventSpeaker, adminUpdateEventSpeaker } from "@/lib/admin.functions";
import { AdminImageUpload } from "./AdminImageUpload";
import { AdminMediaLibrary } from "./AdminMediaLibrary";
import { Button } from "@/components/ui/button";
import { Field, inputClass, textareaClass } from "./AdminBits";

type Speaker = {
  id: string;
  name: string;
  job_title: string | null;
  company: string | null;
  bio: string | null;
  photo_url: string | null;
};

export function EventOwnedSpeakerEditor({ eventId, speaker, onDeleted }: {
  eventId: string;
  speaker: Speaker;
  onDeleted: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const update = useServerFn(adminUpdateEventSpeaker);
  const remove = useServerFn(adminDeleteEventSpeaker);
  const [draft, setDraft] = useState({
    name: speaker.name,
    job_title: speaker.job_title ?? "",
    company: speaker.company ?? "",
    bio: speaker.bio ?? "",
    photo_url: speaker.photo_url ?? "",
  });
  const saveMutation = useMutation({
    mutationFn: () => update({ data: {
      eventId, speakerId: speaker.id, name: draft.name.trim(),
      job_title: draft.job_title.trim() || null,
      company: draft.company.trim() || null,
      bio: draft.bio.trim() || null,
      photo_url: draft.photo_url.trim() || null,
    } }),
    onSuccess: () => {
      toast.success("Speaker updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "speakers", eventId] });
      queryClient.invalidateQueries({ queryKey: ["event"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteMutation = useMutation({
    mutationFn: () => remove({ data: { eventId, speakerId: speaker.id } }),
    onSuccess: () => {
      onDeleted(speaker.id);
      queryClient.invalidateQueries({ queryKey: ["admin", "speakers", eventId] });
      toast.success("One-off speaker deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return <details className="rounded-xl border border-border p-4">
    <summary className="cursor-pointer text-sm font-medium">Edit {speaker.name}</summary>
    <div className="mt-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name"><input className={inputClass} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></Field>
        <Field label="Role or job title"><input className={inputClass} value={draft.job_title} onChange={(event) => setDraft((current) => ({ ...current, job_title: event.target.value }))} /></Field>
        <Field label="Company"><input className={inputClass} value={draft.company} onChange={(event) => setDraft((current) => ({ ...current, company: event.target.value }))} /></Field>
        <Field label="Photo URL"><input className={inputClass} value={draft.photo_url} onChange={(event) => setDraft((current) => ({ ...current, photo_url: event.target.value }))} /></Field>
      </div>
      <AdminImageUpload scope="speaker-photos" label="Upload a new portrait" onUploaded={(url) => setDraft((current) => ({ ...current, photo_url: url }))} />
      <AdminMediaLibrary scope="speaker-photos" selectedUrls={[draft.photo_url]} onChoose={(url) => setDraft((current) => ({ ...current, photo_url: url }))} />
      <Field label="Short bio"><textarea className={textareaClass} value={draft.bio} onChange={(event) => setDraft((current) => ({ ...current, bio: event.target.value }))} /></Field>
      <div className="flex gap-3">
        <Button type="button" disabled={saveMutation.isPending || draft.name.trim().length < 2} onClick={() => saveMutation.mutate()}>Save speaker</Button>
        <Button type="button" variant="outlineInk" disabled={deleteMutation.isPending} onClick={() => {
          if (window.confirm(`Permanently delete ${speaker.name} from this event?`)) deleteMutation.mutate();
        }}>Delete speaker</Button>
      </div>
    </div>
  </details>;
}
