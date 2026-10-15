import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { uploadEventImage, type EventMediaScope } from "@/lib/event-media";
import { eventImageIssue } from "@/lib/event-media-rules";

export function AdminImageUpload({ scope, label, onUploaded, saveLabel = "save the event" }: { scope: EventMediaScope; label: string; onUploaded: (url: string) => void; saveLabel?: string }) {
  const inputId = useId();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium" htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={uploading}
        className="block w-full text-sm file:mr-3 file:rounded-full file:border file:border-accent file:bg-transparent file:px-4 file:py-2 file:text-accent"
        onChange={async (event) => {
          const input = event.currentTarget;
          const file = input.files?.[0];
          if (!file) return;
          setError(null);
          const issue = eventImageIssue(file);
          if (issue) {
            setError(issue);
            input.value = "";
            return;
          }
          setUploading(true);
          try {
            onUploaded(await uploadEventImage(file, scope));
            queryClient.invalidateQueries({ queryKey: ["admin", "event-media", scope] });
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "The upload failed. Please try again.");
          } finally {
            setUploading(false);
            // Keep the same file selectable again after a failed upload.
            input.value = "";
          }
        }}
      />
      <p className="text-xs text-muted-foreground">JPEG, PNG or WebP, up to 5 MB. Choose a file, then {saveLabel} to publish it.</p>
      {uploading && <p className="text-sm" role="status">Uploading photo…</p>}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </div>
  );
}
