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
      description="Save a draft first, then preview, publish, or unpublish it from the editor."
    >
      <EventForm initialEvent={emptyEvent} initialTickets={[]} initialSpeakerIds={[]} initialWorkshops={[]} />
    </AdminPage>
  );
}
