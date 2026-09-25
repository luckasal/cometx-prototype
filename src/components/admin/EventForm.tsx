import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  adminSaveEvent,
  adminDeleteEvent,
  adminListSpeakers,
  adminListEntitlements,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Field, inputClass, textareaClass } from "@/components/admin/AdminBits";

export type EventFormValues = {
  id?: string;
  title: string;
  event_type: string;
  slug: string;
  short_description: string;
  description: string;
  hero_image_url: string;
  gallery_urls: string;
  start_date: string;
  end_date: string;
  venue: string;
  address: string;
  capacity: string;
  registration_start: string;
  registration_end: string;
  publish_state: "draft" | "published" | "unpublished";
  event_status: "upcoming" | "registration_open" | "registration_closed" | "sold_out" | "completed" | "cancelled";
  featured: boolean;
};

export type TicketDraft = {
  id?: string;
  name: string;
  description: string;
  base_price: string;
  capacity: string;
  required_entitlement: string;
  discount_entitlement: string;
  free_entitlement: string;
};

export type WorkshopDraft = {
  id?: string;
  title: string;
  description: string;
  speaker_id: string;
  start_time: string;
  end_time: string;
  location: string;
  capacity: string;
  base_price: string;
  separate_registration_required: boolean;
};

export const emptyEvent: EventFormValues = {
  title: "",
  event_type: "event",
  slug: "",
  short_description: "",
  description: "",
  hero_image_url: "",
  gallery_urls: "",
  start_date: "",
  end_date: "",
  venue: "",
  address: "",
  capacity: "",
  registration_start: "",
  registration_end: "",
  publish_state: "draft",
  event_status: "upcoming",
  featured: false,
};

export const emptyTicket: TicketDraft = {
  name: "",
  description: "",
  base_price: "0",
  capacity: "",
  required_entitlement: "",
  discount_entitlement: "",
  free_entitlement: "",
};

export const emptyWorkshop: WorkshopDraft = {
  title: "", description: "", speaker_id: "", start_time: "", end_time: "", location: "", capacity: "", base_price: "0", separate_registration_required: false,
};

const nullable = (value: string) => (value.trim() === "" ? null : value.trim());
const isoOrNull = (value: string) => (value.trim() === "" ? null : new Date(value).toISOString());

export function EventForm({
  initialEvent,
  initialTickets,
  initialSpeakerIds,
  initialWorkshops,
}: {
  initialEvent: EventFormValues;
  initialTickets: TicketDraft[];
  initialSpeakerIds: string[];
  initialWorkshops: WorkshopDraft[];
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [event, setEvent] = useState<EventFormValues>(initialEvent);
  const [tickets, setTickets] = useState<TicketDraft[]>(initialTickets);
  const [speakerIds, setSpeakerIds] = useState<string[]>(initialSpeakerIds);
  const [workshops, setWorkshops] = useState<WorkshopDraft[]>(initialWorkshops);

  const fetchSpeakers = useServerFn(adminListSpeakers);
  const fetchEntitlements = useServerFn(adminListEntitlements);
  const save = useServerFn(adminSaveEvent);
  const remove = useServerFn(adminDeleteEvent);

  const { data: speakers = [] } = useQuery({
    queryKey: ["admin", "speakers"],
    queryFn: () => fetchSpeakers(),
  });
  const { data: entitlements = [] } = useQuery({
    queryKey: ["admin", "entitlements"],
    queryFn: () => fetchEntitlements(),
  });

  const mutation = useMutation({
    mutationFn: (publishState: EventFormValues["publish_state"]) =>
      save({
        data: {
          event: {
            ...(event.id ? { id: event.id } : {}),
            title: event.title.trim(),
            event_type: event.event_type.trim(),
            slug: event.slug.trim(),
            short_description: nullable(event.short_description),
            description: nullable(event.description),
            hero_image_url: nullable(event.hero_image_url),
            gallery_urls: event.gallery_urls.split("\n").map((url) => url.trim()).filter(Boolean),
            start_date: new Date(event.start_date).toISOString(),
            end_date: isoOrNull(event.end_date),
            venue: nullable(event.venue),
            address: nullable(event.address),
            capacity: event.capacity.trim() === "" ? null : Number(event.capacity),
            registration_start: isoOrNull(event.registration_start),
            registration_end: isoOrNull(event.registration_end),
            publish_state: publishState,
            event_status: event.event_status,
            featured: event.featured,
          },
          speakerIds,
          tickets: tickets
            .filter((ticket) => ticket.name.trim() !== "")
            .map((ticket) => ({
              ...(ticket.id ? { id: ticket.id } : {}),
              name: ticket.name.trim(),
              description: nullable(ticket.description),
              base_price: Number(ticket.base_price || 0),
              currency: "CHF",
              capacity: ticket.capacity.trim() === "" ? null : Number(ticket.capacity),
              required_entitlement: nullable(ticket.required_entitlement),
              discount_entitlement: nullable(ticket.discount_entitlement),
              free_entitlement: nullable(ticket.free_entitlement),
            })),
          workshops: workshops.filter((workshop) => workshop.title.trim() !== "").map((workshop) => ({
            ...(workshop.id ? { id: workshop.id } : {}), title: workshop.title.trim(), description: nullable(workshop.description), speaker_id: nullable(workshop.speaker_id), start_time: isoOrNull(workshop.start_time), end_time: isoOrNull(workshop.end_time), location: nullable(workshop.location), capacity: workshop.capacity.trim() === "" ? null : Number(workshop.capacity), base_price: Number(workshop.base_price || 0), separate_registration_required: workshop.separate_registration_required,
          })),
        } as never,
      }),
    onSuccess: (saved, publishState) => {
      toast.success("Event saved");
      setEvent((previous) => ({ ...previous, id: saved.id, publish_state: publishState }));
      queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["home"] });
      queryClient.invalidateQueries({ queryKey: ["event"] });
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel("cometx-event-saved");
        channel.postMessage({ id: saved.id });
        channel.close();
      }
      if (!event.id) navigate({ to: "/admin/events/$id", params: { id: saved.id } });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => remove({ data: { id: event.id! } }),
    onSuccess: () => {
      toast.success("Event deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
      navigate({ to: "/admin/events" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function set<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    setEvent((prev) => ({ ...prev, [key]: value }));
  }

  function saveAs(publishState: EventFormValues["publish_state"]) {
    if (!event.title.trim() || !event.slug.trim() || !event.start_date) {
      toast.error("Title, slug and start date are required.");
      return;
    }
    mutation.mutate(publishState);
  }

  function setTicket(index: number, key: keyof TicketDraft, value: string) {
    setTickets((prev) => prev.map((t, i) => (i === index ? { ...t, [key]: value } : t)));
  }
  function setWorkshop<K extends keyof WorkshopDraft>(index: number, key: K, value: WorkshopDraft[K]) {
    setWorkshops((previous) => previous.map((workshop, workshopIndex) => workshopIndex === index ? { ...workshop, [key]: value } : workshop));
  }

  return (
    <form
      className="space-y-10"
      onSubmit={(e) => {
        e.preventDefault();
        saveAs("draft");
      }}
    >
      <section className="space-y-5 border border-border bg-card p-6">
        <h2 className="font-display text-lg font-bold">Basics</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Title">
            <input
              className={inputClass}
              value={event.title}
              onChange={(e) => {
                const title = e.target.value;
                set("title", title);
                if (!event.id && !initialEvent.slug)
                  set(
                    "slug",
                    title
                      .toLowerCase()
                      .normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "")
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, ""),
                  );
              }}
            />
          </Field>
          <Field label="Event type" hint="For example: symposium, networking, workshop.">
            <input className={inputClass} value={event.event_type} onChange={(e) => set("event_type", e.target.value)} />
          </Field>
          <Field label="Slug" hint="Lowercase letters, numbers and dashes.">
            <input
              className={inputClass}
              value={event.slug}
              onChange={(e) => set("slug", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Short description">
          <input
            className={inputClass}
            value={event.short_description}
            onChange={(e) => set("short_description", e.target.value)}
          />
        </Field>
        <Field label="Long description">
          <p className="mb-2 text-xs text-muted-foreground">Optional sections: start a line with ## What to expect, ## Who is this event for? or ## Practical information (Czech headings also work). Use - for bullet points. Empty sections stay hidden. Save to update an open preview.</p>
          <textarea
            className={textareaClass}
            rows={8}
            value={event.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>
        <Field label="Hero image URL">
          <input
            className={inputClass}
            value={event.hero_image_url}
            onChange={(e) => set("hero_image_url", e.target.value)}
            placeholder="https://..."
          />
        </Field>
        <Field label="Gallery image URLs" hint="One image URL per line. Optional on public pages.">
          <textarea className={textareaClass} rows={3} value={event.gallery_urls} onChange={(e) => set("gallery_urls", e.target.value)} placeholder="https://..." />
        </Field>
      </section>

      <section className="space-y-5 border border-border bg-card p-6">
        <h2 className="font-display text-lg font-bold">When and where</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Start">
            <input
              type="datetime-local"
              className={inputClass}
              value={event.start_date}
              onChange={(e) => set("start_date", e.target.value)}
            />
          </Field>
          <Field label="End">
            <input
              type="datetime-local"
              className={inputClass}
              value={event.end_date}
              onChange={(e) => set("end_date", e.target.value)}
            />
          </Field>
          <Field label="Venue">
            <input
              className={inputClass}
              value={event.venue}
              onChange={(e) => set("venue", e.target.value)}
            />
          </Field>
          <Field label="Address">
            <input
              className={inputClass}
              value={event.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-5 border border-border bg-card p-6">
        <h2 className="font-display text-lg font-bold">Registration</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Capacity" hint="Leave empty for unlimited.">
            <input
              type="number"
              min={1}
              className={inputClass}
              value={event.capacity}
              onChange={(e) => set("capacity", e.target.value)}
            />
          </Field>
          <Field label="Event status" hint="Controls registration and labels; it does not publish the event.">
            <select
              className={inputClass}
              value={event.event_status}
              onChange={(e) => set("event_status", e.target.value as EventFormValues["event_status"])}
            >
              {[
                "upcoming",
                "registration_open",
                "registration_closed",
                "sold_out",
                "completed",
                "cancelled",
              ].map((status) => (
                <option key={status} value={status}>
                  {status.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Registration opens">
            <input
              type="datetime-local"
              className={inputClass}
              value={event.registration_start}
              onChange={(e) => set("registration_start", e.target.value)}
            />
          </Field>
          <Field label="Registration closes">
            <input
              type="datetime-local"
              className={inputClass}
              value={event.registration_end}
              onChange={(e) => set("registration_end", e.target.value)}
            />
          </Field>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={event.featured}
            onChange={(e) => set("featured", e.target.checked)}
          />
          Feature this event on the homepage
        </label>
      </section>

      <section className="space-y-4 border border-border bg-card p-6">
        <h2 className="font-display text-lg font-bold">Speakers</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {speakers.map((speaker) => (
            <label key={speaker.id} className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={speakerIds.includes(speaker.id)}
                onChange={(e) =>
                  setSpeakerIds((prev) =>
                    e.target.checked
                      ? [...prev, speaker.id]
                      : prev.filter((id) => id !== speaker.id),
                  )
                }
              />
              {speaker.name}
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-6 border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Ticket types</h2>
          <Button
            type="button"
            variant="outlineInk"
            size="sm"
            onClick={() => setTickets((prev) => [...prev, { ...emptyTicket }])}
          >
            Add ticket
          </Button>
        </div>
        {tickets.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No ticket types yet. Without one, nobody can register.
          </p>
        )}
        {tickets.map((ticket, index) => (
          <div key={index} className="space-y-4 border-t border-border pt-5">
            <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr_auto]">
              <Field label="Name">
                <input
                  className={inputClass}
                  value={ticket.name}
                  onChange={(e) => setTicket(index, "name", e.target.value)}
                />
              </Field>
              <Field label="Base price (CHF)">
                <input
                  type="number"
                  min={0}
                  step="1"
                  className={inputClass}
                  value={ticket.base_price}
                  onChange={(e) => setTicket(index, "base_price", e.target.value)}
                />
              </Field>
              <Field label="Capacity">
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={ticket.capacity}
                  onChange={(e) => setTicket(index, "capacity", e.target.value)}
                />
              </Field>
              <button
                type="button"
                className="mt-7 text-destructive"
                aria-label="Remove ticket"
                onClick={() => setTickets((prev) => prev.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            <Field label="Description">
              <input
                className={inputClass}
                value={ticket.description}
                onChange={(e) => setTicket(index, "description", e.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              {(
                [
                  ["required_entitlement", "Requires entitlement"],
                  ["discount_entitlement", "Discount entitlement"],
                  ["free_entitlement", "Free with entitlement"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <select
                    className={inputClass}
                    value={ticket[key]}
                    onChange={(e) => setTicket(index, key, e.target.value)}
                  >
                    <option value="">None</option>
                    {entitlements.map((ent) => (
                      <option key={ent.key} value={ent.key}>
                        {ent.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-6 border border-border bg-card p-6">
        <div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold">Programme and workshops</h2><Button type="button" variant="outlineInk" size="sm" onClick={() => setWorkshops((previous) => [...previous, { ...emptyWorkshop }])}>Add workshop</Button></div>
        {workshops.length === 0 && <p className="text-sm text-muted-foreground">Optional. Add workshops or programme sessions shown on the public event page.</p>}
        {workshops.map((workshop, index) => <div key={workshop.id ?? index} className="space-y-4 border-t border-border pt-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Title"><input className={inputClass} value={workshop.title} onChange={(event) => setWorkshop(index, "title", event.target.value)} /></Field><Field label="Speaker"><select className={inputClass} value={workshop.speaker_id} onChange={(event) => setWorkshop(index, "speaker_id", event.target.value)}><option value="">No speaker</option>{speakers.map((speaker) => <option key={speaker.id} value={speaker.id}>{speaker.name}</option>)}</select></Field><Field label="Start"><input type="datetime-local" className={inputClass} value={workshop.start_time} onChange={(event) => setWorkshop(index, "start_time", event.target.value)} /></Field><Field label="End"><input type="datetime-local" className={inputClass} value={workshop.end_time} onChange={(event) => setWorkshop(index, "end_time", event.target.value)} /></Field><Field label="Location"><input className={inputClass} value={workshop.location} onChange={(event) => setWorkshop(index, "location", event.target.value)} /></Field><Field label="Capacity"><input type="number" min={1} className={inputClass} value={workshop.capacity} onChange={(event) => setWorkshop(index, "capacity", event.target.value)} /></Field></div><Field label="Description"><textarea className={textareaClass} value={workshop.description} onChange={(event) => setWorkshop(index, "description", event.target.value)} /></Field><div className="flex flex-wrap items-end justify-between gap-4"><Field label="Price (CHF)" className="w-40"><input type="number" min={0} className={inputClass} value={workshop.base_price} onChange={(event) => setWorkshop(index, "base_price", event.target.value)} /></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={workshop.separate_registration_required} onChange={(event) => setWorkshop(index, "separate_registration_required", event.target.checked)} />Separate registration required</label><button type="button" className="text-xs text-destructive underline" onClick={() => setWorkshops((previous) => previous.filter((_, workshopIndex) => workshopIndex !== index))}>Remove</button></div></div>)}
      </section>

      <div className="flex flex-wrap gap-3">
        {event.id && event.slug && (
          <Button asChild type="button" variant="outlineInk" size="lg">
            <a href={`/events/${encodeURIComponent(event.slug)}?preview=1`} target="_blank" rel="noreferrer">Preview</a>
          </Button>
        )}
        <Button type="submit" variant="outlineInk" size="lg" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save draft"}
        </Button>
        <Button type="button" variant="ink" size="lg" disabled={mutation.isPending} onClick={() => saveAs("published")}>Publish</Button>
        {event.id && <Button type="button" variant="outline" size="lg" disabled={mutation.isPending} onClick={() => saveAs("unpublished")}>Unpublish</Button>}
        <Button
          type="button"
          variant="outlineInk"
          size="lg"
          onClick={() => navigate({ to: "/admin/events" })}
        >
          Cancel
        </Button>
        {event.id && (
          <Button
            type="button"
            variant="destructive"
            size="lg"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (confirm(`Delete \"${event.title}\"? Events with registrations cannot be deleted.`)) deleteMutation.mutate();
            }}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        )}
      </div>
    </form>
  );
}
