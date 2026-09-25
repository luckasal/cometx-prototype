import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminGetEvent } from "@/lib/admin.functions";
import { AdminPage } from "@/components/admin/AdminBits";
import { EventForm, type EventFormValues, type TicketDraft, type WorkshopDraft } from "@/components/admin/EventForm";
import { ErrorBlock, LoadingBlock } from "@/components/site/Bits";

export const Route = createFileRoute("/admin/events/$id")({
  component: EditEventPage,
});

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function EditEventPage() {
  const { id } = Route.useParams();
  const fetchEvent = useServerFn(adminGetEvent);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "event", id],
    queryFn: () => fetchEvent({ data: { id } }),
  });

  if (isLoading)
    return (
      <AdminPage title="Edit event">
        <LoadingBlock label="Loading event" />
      </AdminPage>
    );
  if (error)
    return (
      <AdminPage title="Edit event">
        <ErrorBlock error={error} />
      </AdminPage>
    );
  if (!data?.event)
    return (
      <AdminPage title="Edit event">
        <p className="text-sm text-muted-foreground">This event no longer exists.</p>
      </AdminPage>
    );

  const e = data.event;
  const initialEvent: EventFormValues = {
    id: e.id,
    title: e.title,
    event_type: e.event_type,
    slug: e.slug,
    short_description: e.short_description ?? "",
    description: e.description ?? "",
    hero_image_url: e.hero_image_url ?? "",
    gallery_urls: Array.isArray(e.gallery_urls) ? e.gallery_urls.filter((url): url is string => typeof url === "string").join("\n") : "",
    start_date: toLocalInput(e.start_date),
    end_date: toLocalInput(e.end_date),
    venue: e.venue ?? "",
    address: e.address ?? "",
    capacity: e.capacity === null ? "" : String(e.capacity),
    registration_start: toLocalInput(e.registration_start),
    registration_end: toLocalInput(e.registration_end),
    publish_state: e.publish_state,
    event_status: e.event_status,
    featured: !!e.featured,
  };

  const initialTickets: TicketDraft[] = data.tickets.map((ticket) => ({
    id: ticket.id,
    name: ticket.name,
    description: ticket.description ?? "",
    base_price: String(Number(ticket.base_price)),
    capacity: ticket.capacity === null ? "" : String(ticket.capacity),
    required_entitlement: ticket.required_entitlement ?? "",
    discount_entitlement: ticket.discount_entitlement ?? "",
    free_entitlement: ticket.free_entitlement ?? "",
  }));
  const initialWorkshops: WorkshopDraft[] = data.workshops.map((workshop) => ({
    id: workshop.id, title: workshop.title, description: workshop.description ?? "", speaker_id: workshop.speaker_id ?? "", start_time: toLocalInput(workshop.start_time), end_time: toLocalInput(workshop.end_time), location: workshop.location ?? "", capacity: workshop.capacity === null ? "" : String(workshop.capacity), base_price: String(Number(workshop.base_price)), separate_registration_required: workshop.separate_registration_required,
  }));

  return (
    <AdminPage title={e.title} description={`Editing /events/${e.slug}. Save changes before refreshing the preview.`}>
      <EventForm
        initialEvent={initialEvent}
        initialTickets={initialTickets}
        initialSpeakerIds={data.speakerIds}
        initialWorkshops={initialWorkshops}
      />
    </AdminPage>
  );
}
