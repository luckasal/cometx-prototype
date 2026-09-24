import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  adminSaveEvent,
  adminListSpeakers,
  adminListEntitlements,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Field, inputClass, textareaClass } from "@/components/admin/AdminBits";

export type EventFormValues = {
  id?: string;
  title: string;
  slug: string;
  short_description: string;
  description: string;
  hero_image_url: string;
  start_date: string;
  end_date: string;
  venue: string;
  address: string;
  capacity: string;
  registration_start: string;
  registration_end: string;
  status: string;
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

export const emptyEvent: EventFormValues = {
  title: "",
  slug: "",
  short_description: "",
  description: "",
  hero_image_url: "",
  start_date: "",
  end_date: "",
  venue: "",
  address: "",
  capacity: "",
  registration_start: "",
  registration_end: "",
  status: "draft",
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

const nullable = (value: string) => (value.trim() === "" ? null : value.trim());
const isoOrNull = (value: string) => (value.trim() === "" ? null : new Date(value).toISOString());

export function EventForm({
  initialEvent,
  initialTickets,
  initialSpeakerIds,
}: {
  initialEvent: EventFormValues;
  initialTickets: TicketDraft[];
  initialSpeakerIds: string[];
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [event, setEvent] = useState<EventFormValues>(initialEvent);
  const [tickets, setTickets] = useState<TicketDraft[]>(initialTickets);
  const [speakerIds, setSpeakerIds] = useState<string[]>(initialSpeakerIds);

  const fetchSpeakers = useServerFn(adminListSpeakers);
  const fetchEntitlements = useServerFn(adminListEntitlements);
  const save = useServerFn(adminSaveEvent);

  const { data: speakers = [] } = useQuery({
    queryKey: ["admin", "speakers"],
    queryFn: () => fetchSpeakers(),
  });
  const { data: entitlements = [] } = useQuery({
    queryKey: ["admin", "entitlements"],
    queryFn: () => fetchEntitlements(),
  });

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          event: {
            ...(event.id ? { id: event.id } : {}),
            title: event.title.trim(),
            slug: event.slug.trim(),
            short_description: nullable(event.short_description),
            description: nullable(event.description),
            hero_image_url: nullable(event.hero_image_url),
            start_date: new Date(event.start_date).toISOString(),
            end_date: isoOrNull(event.end_date),
            venue: nullable(event.venue),
            address: nullable(event.address),
            capacity: event.capacity.trim() === "" ? null : Number(event.capacity),
            registration_start: isoOrNull(event.registration_start),
            registration_end: isoOrNull(event.registration_end),
            status: event.status,
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
        } as never,
      }),
    onSuccess: () => {
      toast.success("Event saved");
      queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["home"] });
      navigate({ to: "/admin/events" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function set<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    setEvent((prev) => ({ ...prev, [key]: value }));
  }

  function setTicket(index: number, key: keyof TicketDraft, value: string) {
    setTickets((prev) => prev.map((t, i) => (i === index ? { ...t, [key]: value } : t)));
  }

  return (
    <form
      className="space-y-10"
      onSubmit={(e) => {
        e.preventDefault();
        if (!event.title.trim() || !event.slug.trim() || !event.start_date) {
          toast.error("Title, slug and start date are required.");
          return;
        }
        mutation.mutate();
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
          <Field label="Status">
            <select
              className={inputClass}
              value={event.status}
              onChange={(e) => set("status", e.target.value)}
            >
              {[
                "draft",
                "published",
                "registration_open",
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

      <div className="flex gap-3">
        <Button type="submit" variant="ink" size="lg" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save event"}
        </Button>
        <Button
          type="button"
          variant="outlineInk"
          size="lg"
          onClick={() => navigate({ to: "/admin/events" })}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
