import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/components/admin/AdminBits";
import { EventForm, emptyEvent } from "@/components/admin/EventForm";

export const Route = createFileRoute("/admin/events/new")({
  component: NewEventPage,
});

function NewEventPage() {
  return (
    <AdminPage
      title="New event"
      description="Save as draft while you work, then switch the status to published or registration open."
    >
      <EventForm initialEvent={emptyEvent} initialTickets={[]} initialSpeakerIds={[]} />
    </AdminPage>
  );
}
