import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminDeleteEvent, adminListEvents, adminSetEventPublishState } from "@/lib/admin.functions";
import { formatEventLifecycleStatus, getEventLifecycleStatus } from "@/lib/event-admin";
import { formatMoney } from "@/lib/pricing";
import { AdminPage, AdminTable } from "@/components/admin/AdminBits";
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from "@/components/site/Bits";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/events/")({ component: AdminEventsPage });

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function eventRevenue(amounts: Record<string, number> | null) {
  if (!amounts) return "—";
  const entries = Object.entries(amounts);
  return entries.length ? entries.map(([currency, amount]) => formatMoney(amount / 100, currency)).join(" · ") : "—";
}

function lifecycleTone(status: string): "signal" | "success" | "muted" {
  if (status === "published") return "signal";
  if (status === "completed") return "success";
  return "muted";
}

function AdminEventsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const fetchEvents = useServerFn(adminListEvents);
  const deleteEvent = useServerFn(adminDeleteEvent);
  const setPublishState = useServerFn(adminSetEventPublishState);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin", "events"], queryFn: () => fetchEvents() });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
  const remove = useMutation({
    mutationFn: (id: string) => deleteEvent({ data: { id } }),
    onSuccess: () => { toast.success("Event deleted"); void refresh(); },
    onError: (err: Error) => toast.error(err.message),
  });
  const publish = useMutation({
    mutationFn: ({ id, publishState }: { id: string; publishState: "published" | "unpublished" }) => setPublishState({ data: { id, publishState } }),
    onSuccess: (_result, variables) => {
      toast.success(variables.publishState === "published" ? "Event published" : "Event unpublished");
      void refresh();
      void queryClient.invalidateQueries({ queryKey: ["events"] });
      void queryClient.invalidateQueries({ queryKey: ["home"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return (data ?? []).filter((event) => {
      const lifecycle = getEventLifecycleStatus(event);
      const matchesSearch = !term || [event.title, event.slug, event.venue, event.address].some((value) => value?.toLocaleLowerCase().includes(term));
      return matchesSearch
        && (lifecycleFilter === "all" || lifecycle === lifecycleFilter)
        && (typeFilter === "all" || event.event_type === typeFilter);
    });
  }, [data, lifecycleFilter, search, typeFilter]);

  return (
    <AdminPage
      title="Events"
      description="Find events, check their sales, and manage publication status."
      action={<Button asChild variant="ink"><Link to="/admin/events/new">Add event</Link></Button>}
    >
      <div className="mb-5 grid gap-3 rounded-2xl border border-border/60 bg-card p-4 sm:grid-cols-[minmax(16rem,1fr)_12rem_12rem]">
        <label className="text-sm font-medium">Search events
          <input className="mt-2 block min-h-11 w-full rounded-xl border border-input bg-background px-4 font-normal" type="search" placeholder="Title, slug or location" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label className="text-sm font-medium">Lifecycle
          <select className="mt-2 block min-h-11 w-full rounded-xl border border-input bg-background px-3 font-normal" value={lifecycleFilter} onChange={(event) => setLifecycleFilter(event.target.value)}>
            <option value="all">All statuses</option>
            {["draft", "published", "unpublished", "completed", "cancelled"].map((status) => <option key={status} value={status}>{formatEventLifecycleStatus(status)}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Event type
          <select className="mt-2 block min-h-11 w-full rounded-xl border border-input bg-background px-3 font-normal" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">All types</option>
            {[...new Set((data ?? []).map((event) => event.event_type))].sort().map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
          </select>
        </label>
      </div>

      {isLoading && <LoadingBlock label="Loading events" />}
      {error && <ErrorBlock error={error} />}
      {data?.some((event) => !event.metrics) && <p role="status" className="mb-4 rounded-xl border border-border/60 bg-card px-4 py-3 text-sm text-muted-foreground">Sales totals are temporarily unavailable. Event details and publishing are still available.</p>}
      {data && data.length === 0 && <EmptyBlock title="No events yet" hint="Add an event to start publishing your programme." />}
      {data && data.length > 0 && filtered.length === 0 && <EmptyBlock title="No matching events" hint="Change the search or filters and try again." />}
      {filtered.length > 0 && (
        <AdminTable head={["Event", "Lifecycle", "Start", "Location", "Tickets sold", "Revenue", "Last modified", "Actions"]}>
          {filtered.map((event) => {
            const lifecycle = getEventLifecycleStatus(event);
            const eventPath = `/events/${encodeURIComponent(event.slug)}`;
            const previewPath = `${eventPath}?preview=1`;
            const metrics = event.metrics;
            return (
              <tr key={event.id} className="align-middle [&>td]:px-3 [&>td]:py-3">
                <td className="min-w-56">
                  <div className="flex items-center gap-3">
                    {event.hero_image_url ? <img src={event.hero_image_url} alt="" loading="lazy" className="size-14 shrink-0 rounded-lg object-cover" /> : <div aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-lg bg-muted text-xs text-muted-foreground">No image</div>}
                    <div className="min-w-0"><Link to="/admin/events/$id" params={{ id: event.id }} className="font-semibold hover:underline">{event.title}</Link><span className="block truncate text-xs text-muted-foreground">/{event.slug}</span></div>
                  </div>
                </td>
                <td className="min-w-32"><StatusPill tone={lifecycleTone(lifecycle)}>{formatEventLifecycleStatus(lifecycle)}</StatusPill>{event.event_status !== "upcoming" && event.event_status !== "completed" && event.event_status !== "cancelled" && <span className="mt-1 block text-xs capitalize text-muted-foreground">{event.event_status.replaceAll("_", " ")}</span>}</td>
                <td className="min-w-36 text-muted-foreground">{formatDate(event.start_date)}</td>
                <td className="min-w-36 text-muted-foreground">{event.venue || event.address || "—"}</td>
                <td className="text-center tabular-nums">{metrics?.ticketsSold ?? "—"}</td>
                <td className="min-w-28 whitespace-nowrap tabular-nums">{eventRevenue(metrics?.revenueByCurrencyMinor ?? null)}</td>
                <td className="min-w-36 text-muted-foreground">{formatDate(event.updated_at)}</td>
                <td className="min-w-48"><div className="flex flex-wrap justify-end gap-x-3 gap-y-2 text-xs">
                  <Link to="/admin/events/$id" params={{ id: event.id }} className="underline underline-offset-4">Edit</Link>
                  <a href={event.publish_state === "published" ? eventPath : previewPath} target="_blank" rel="noreferrer" className="underline underline-offset-4">{event.publish_state === "published" ? "View" : "Preview"}</a>
                  <button type="button" className="underline underline-offset-4 disabled:opacity-50" disabled={publish.isPending} onClick={() => publish.mutate({ id: event.id, publishState: event.publish_state === "published" ? "unpublished" : "published" })}>{event.publish_state === "published" ? "Unpublish" : "Publish"}</button>
                  <button type="button" className="text-destructive underline underline-offset-4 disabled:opacity-50" disabled={remove.isPending} onClick={() => { if (confirm(`Delete “${event.title}”? This cannot be undone.`)) remove.mutate(event.id); }}>Delete</button>
                </div></td>
              </tr>
            );
          })}
        </AdminTable>
      )}
    </AdminPage>
  );
}
