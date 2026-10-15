import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminDeleteUnusedEventMedia, adminListEventMedia } from "@/lib/admin.functions";
import type { EventMediaScope } from "@/lib/event-media";
import { Button } from "@/components/ui/button";

type MediaItem = { path: string; url: string; createdAt: string };

export function AdminMediaLibrary({ scope, onChoose, selectedUrls }: {
  scope: EventMediaScope;
  onChoose: (url: string) => void;
  selectedUrls: string[];
}) {
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const list = useServerFn(adminListEventMedia);
  const remove = useServerFn(adminDeleteUnusedEventMedia);
  const { data: items = [], isPending, error } = useQuery<MediaItem[]>({
    queryKey: ["admin", "event-media", scope, page],
    queryFn: async () => (await list({ data: { scope, offset: page * 100 } })) as MediaItem[],
    enabled: open,
  });
  const deleteMutation = useMutation({
    mutationFn: (path: string) => remove({ data: { path } }),
    onSuccess: () => {
      toast.success("Unused photo deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "event-media", scope] });
    },
    onError: (cause: Error) => toast.error(cause.message),
  });

  return <details className="rounded-xl border border-border p-4" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer text-sm font-medium">Browse uploaded CometX photos</summary>
    {isPending && <p className="mt-3 text-sm text-muted-foreground">Loading photos…</p>}
    {error && <p className="mt-3 text-sm text-destructive">Photos could not be loaded. Try reopening this section.</p>}
    {!isPending && !error && items.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No uploaded photos in this section.</p>}
    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item: MediaItem) => <div key={item.path} className="space-y-2 rounded-lg border border-border p-2">
        <img src={item.url} alt="Uploaded CometX event media" className="h-28 w-full rounded-md object-cover" />
        <p className="truncate text-xs text-muted-foreground" title={item.path}>{item.path}</p>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outlineInk" onClick={() => onChoose(item.url)}>Use photo</Button>
          <Button type="button" size="sm" variant="ghost" disabled={selectedUrls.includes(item.url) || deleteMutation.isPending} onClick={() => {
            if (window.confirm("Permanently delete this unused uploaded photo? A photo attached to a saved event or speaker cannot be deleted.")) deleteMutation.mutate(item.path);
          }}>Delete unused</Button>
        </div>
      </div>)}
    </div>
    <div className="mt-3 flex gap-2">
      {page > 0 && <Button type="button" size="sm" variant="outlineInk" onClick={() => setPage((current) => current - 1)}>Previous</Button>}
      {items.length === 100 && <Button type="button" size="sm" variant="outlineInk" onClick={() => setPage((current) => current + 1)}>More photos</Button>}
    </div>
    <p className="mt-3 text-xs text-muted-foreground">Remove a photo from the event and save before deleting its stored file. Photos still referenced by saved content are protected.</p>
  </details>;
}
