import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminListEvents, adminDeleteEvent } from "@/lib/admin.functions";
import { AdminPage, AdminTable } from "@/components/admin/AdminBits";
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from "@/components/site/Bits";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/events/")({
  component: AdminEventsPage,
});

function AdminEventsPage() {
  const queryClient = useQueryClient();
  const fetchEvents = useServerFn(adminListEvents);
  const deleteEvent = useServerFn(adminDeleteEvent);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "events"],
    queryFn: () => fetchEvents(),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteEvent({ data: { id } }),
    onSuccess: () => {
      toast.success("Event deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <AdminPage
      title="Events"
      description="Only published events appear on the public site. Operational status controls registration separately."
      action={
        <Button asChild variant="ink">
          <Link to="/admin/events/new">New event</Link>
        </Button>
      }
    >
      {isLoading && <LoadingBlock label="Loading events" />}
      {error && <ErrorBlock error={error} />}
      {data && data.length === 0 && <EmptyBlock title="No events yet" />}
      {data && data.length > 0 && (
        <AdminTable head={["Title", "Date", "Visibility", "Event status", "Capacity", ""]}>
          {data.map((event) => (
            <tr key={event.id} className="[&>td]:px-4 [&>td]:py-3">
              <td>
                <Link
                  to="/admin/events/$id"
                  params={{ id: event.id }}
                  className="font-medium hover:underline"
                >
                  {event.title}
                </Link>
                <span className="block text-xs text-muted-foreground">/{event.slug}</span>
              </td>
              <td className="text-muted-foreground">
                {new Date(event.start_date).toLocaleDateString("en-GB")}
              </td>
              <td>
                <StatusPill tone={event.publish_state === "published" ? "signal" : "muted"}>
                  {event.publish_state}
                </StatusPill>
              </td>
              <td className="capitalize text-muted-foreground">{event.event_status.replace(/_/g, " ")}</td>
              <td className="text-muted-foreground">{event.capacity ?? "-"}</td>
              <td className="text-right">
                <button
                  className="text-xs text-destructive underline underline-offset-4"
                  onClick={() => {
                    if (confirm(`Delete "${event.title}"? This cannot be undone.`))
                      remove.mutate(event.id);
                  }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </AdminPage>
  );
}
