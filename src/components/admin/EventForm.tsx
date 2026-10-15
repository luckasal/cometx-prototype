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
  adminListEventBenefitMatrix,
} from "@/lib/admin.functions";
import { AdminImageUpload } from "@/components/admin/AdminImageUpload";
import { EventOwnedSpeakerEditor } from "@/components/admin/EventOwnedSpeakerEditor";
import { Button } from "@/components/ui/button";
import { Field, inputClass, textareaClass } from "@/components/admin/AdminBits";
import { formatMoney, isRegistrationOpen } from "@/lib/pricing";
import { ticketAvailability, ticketAvailabilityMessage } from "@/lib/ticket-availability";
import { earliestTicketSaleStart, eventScheduleIssue } from "@/lib/event-admin";

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
  member_price: string;
  sale_start: string;
  sale_end: string;
  currency: string;
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
  event_type: "regular_event",
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
  event_status: "registration_open",
  featured: false,
};

export const emptyTicket: TicketDraft = {
  name: "",
  description: "",
  base_price: "0",
  member_price: "",
  sale_start: "",
  sale_end: "",
  currency: "CHF",
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

const ticketBenefitKeys: Record<string, { discount?: string; free?: string }> = {
  symposium: { discount: "symposium_half_price", free: "symposium_free_ticket" },
  regular_event: { discount: "other_events_discount" },
  potlach: { discount: "potlach_discount", free: "potlach_free_ticket" },
  workshop: {},
};

type EventBenefitPlan = {
  id: string;
  name: string;
  plan_entitlements: { value: number | null; entitlements: { key: string; name: string } | null }[];
};

function describePlanBenefit(key: string, value: number | null): string {
  if (key === "workshop_credit" && value !== null) return `CHF ${value} workshop credit`;
  if (["symposium_half_price", "other_events_discount", "potlach_discount"].includes(key) && value !== null) return `${value}% off`;
  return "Included";
}

type EventSpeakerOption = { id: string; name: string; event_id: string | null; job_title: string | null; company: string | null; bio: string | null; photo_url: string | null };

export function EventForm({
  initialEvent,
  initialTickets,
  initialSpeakerIds,
  initialWorkshops,
  initialTicketStats = {},
  section,
}: {
  initialEvent: EventFormValues;
  initialTickets: TicketDraft[];
  initialSpeakerIds: string[];
  initialWorkshops: WorkshopDraft[];
  initialTicketStats?: Record<string, { ticketsSold: number; revenueByCurrencyMinor: Record<string, number> }> | null;
  section?: "tickets" | "settings" | "content";
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [event, setEvent] = useState<EventFormValues>(initialEvent);
  const [tickets, setTickets] = useState<TicketDraft[]>(initialTickets);
  const [speakerIds, setSpeakerIds] = useState<string[]>(initialSpeakerIds);
  const [speakerDraft, setSpeakerDraft] = useState({ name: "", job_title: "", company: "", bio: "", photo_url: "" });
  const [newSpeakers, setNewSpeakers] = useState<typeof speakerDraft[]>([]);
  const [workshops, setWorkshops] = useState<WorkshopDraft[]>(initialWorkshops);
  const openingTicket = earliestTicketSaleStart(tickets.filter((ticket) => ticket.name.trim()));
  const registrationOpening = openingTicket?.sale_start || event.registration_start;
  const galleryPhotos = event.gallery_urls.split("\n").map((url) => url.trim()).filter(Boolean);

  const fetchSpeakers = useServerFn(adminListSpeakers);
  const fetchEntitlements = useServerFn(adminListEntitlements);
  const fetchBenefitMatrix = useServerFn(adminListEventBenefitMatrix);
  const save = useServerFn(adminSaveEvent);
  const remove = useServerFn(adminDeleteEvent);

  const { data: speakers = [] } = useQuery<EventSpeakerOption[]>({
    queryKey: ["admin", "speakers", event.id ?? "new"],
    queryFn: async () => (await fetchSpeakers({ data: event.id ? { eventId: event.id } : {} })) as EventSpeakerOption[],
  });
  const { data: entitlements = [] } = useQuery({
    queryKey: ["admin", "entitlements"],
    queryFn: () => fetchEntitlements(),
  });
  const { data: benefitMatrix = [], error: benefitsError, isLoading: benefitsLoading } = useQuery<EventBenefitPlan[]>({
    queryKey: ["admin", "event-benefit-matrix"],
    queryFn: async () => (await fetchBenefitMatrix()) as EventBenefitPlan[],
    enabled: !section || section === "tickets",
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
            registration_start: isoOrNull(registrationOpening),
            registration_end: isoOrNull(event.registration_end),
            publish_state: publishState,
            event_status: event.event_status,
            featured: event.featured,
          },
          speakerIds,
          newSpeakers: newSpeakers.map((draft) => ({
            name: draft.name.trim(),
            job_title: nullable(draft.job_title),
            company: nullable(draft.company),
            bio: nullable(draft.bio),
            photo_url: nullable(draft.photo_url),
          })),
          tickets: tickets
            .filter((ticket) => ticket.name.trim() !== "")
            .map((ticket) => ({
              ...(ticket.id ? { id: ticket.id } : {}),
              name: ticket.name.trim(),
              description: nullable(ticket.description),
              base_price: Number(ticket.base_price || 0),
              currency: ticket.currency,
              member_price: ticket.member_price.trim()==="" ? null : Number(ticket.member_price),
              sale_start: isoOrNull(ticket.sale_start),
              sale_end: isoOrNull(ticket.sale_end),
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
    onSuccess: (saved: { id: string; slug: string; paymentSyncReady: boolean; ticketIds: string[]; newSpeakerIds: string[] }, publishState: EventFormValues["publish_state"]) => {
      toast.success("Event saved");
      if (!saved.paymentSyncReady) toast.warning("Content saved. Online payments are not ready; save again to retry payment setup.");
      setTickets(previous => previous.filter(t=>t.name.trim()!=="").map((t,i)=>({...(saved.ticketIds[i] ? {id:saved.ticketIds[i]} : {}),...t})));
      setEvent((previous) => ({ ...previous, id: saved.id, publish_state: publishState, registration_start: registrationOpening }));
      setSpeakerIds((previous) => [...previous, ...saved.newSpeakerIds]);
      setNewSpeakers([]);
      queryClient.invalidateQueries({ queryKey: ["admin", "speakers"] });
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
    const scheduleIssue = eventScheduleIssue({
      start_date: event.start_date,
      end_date: event.end_date || null,
      registration_start: registrationOpening || null,
      registration_end: event.registration_end || null,
    });
    if (scheduleIssue) {
      toast.error(scheduleIssue);
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
      <section hidden={!!section && section !== "content"} className="space-y-5 rounded-2xl border border-border/60 bg-card p-6">
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
          <Field label="Event type" hint="Membership pricing follows this category.">
            <select className={inputClass} value={event.event_type} onChange={(e) => set("event_type", e.target.value)}>
              <option value="regular_event">Regular event</option>
              <option value="symposium">SCAS Symposium</option>
              <option value="potlach">Beer POTLA.CH</option>
              <option value="workshop">Workshop</option>
            </select>
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
        <div className="space-y-4 rounded-xl border border-border bg-background p-4">
          <h3 className="font-display text-lg font-bold">Main event photo</h3>
          {event.hero_image_url && <div className="space-y-2">
            <img src={event.hero_image_url} alt="Current main event photo" className="max-h-64 w-full rounded-xl object-cover" />
            <Button type="button" variant="outlineInk" size="sm" onClick={() => set("hero_image_url", "")}>Remove from event</Button>
          </div>}
          <AdminImageUpload scope="event-heroes" label={event.hero_image_url ? "Replace with a photo from your computer" : "Choose a photo from your computer"} onUploaded={(url) => set("hero_image_url", url)} />
        </div>
        <div className="space-y-4 rounded-xl border border-border bg-background p-4">
          <h3 className="font-display text-lg font-bold">Gallery photos <span className="text-sm font-normal text-muted-foreground">(optional)</span></h3>
          {galleryPhotos.length > 0 && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {galleryPhotos.map((url, index) => <div key={`${url}-${index}`} className="space-y-2 rounded-xl border border-border p-2">
              <img src={url} alt={`Event gallery photo ${index + 1}`} className="h-40 w-full rounded-lg object-cover" />
              <Button type="button" variant="outlineInk" size="sm" onClick={() => set("gallery_urls", galleryPhotos.filter((_, photoIndex) => photoIndex !== index).join("\n"))}>Remove from event</Button>
            </div>)}
          </div>}
          <AdminImageUpload scope="event-gallery" label="Add a gallery photo from your computer" onUploaded={(url) => set("gallery_urls", [...galleryPhotos, url].join("\n"))} />
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

      <section hidden={!!section && section !== "content"} className="space-y-5 rounded-2xl border border-border/60 bg-card p-6">
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

      <section hidden={!!section && section !== "tickets"} className="rounded-2xl border border-border/60 bg-card p-6">
        <details className="rounded-xl border border-border bg-background p-4">
          <summary className="cursor-pointer font-semibold">Event-wide ticket sales settings · {event.event_status === "registration_open" ? "Open" : event.event_status === "upcoming" ? "Not open yet" : event.event_status === "registration_closed" ? "Closed" : event.event_status.replace(/_/g, " ")}</summary>
          <p className="mt-3 text-sm text-muted-foreground">Buying a ticket registers its attendee. Publish the event, set sales to Open, and add at least one ticket type below. Ticket-specific dates and eligibility are set on each ticket.</p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Overall event capacity" hint="Across all ticket types. Leave empty for unlimited.">
            <input
              type="number"
              min={1}
              className={inputClass}
              value={event.capacity}
              onChange={(e) => set("capacity", e.target.value)}
            />
          </Field>
          <Field label="Ticket sales status" hint="Open allows eligible tickets to be bought during their sale dates. Publishing the event alone does not open sales.">
            <select
              className={inputClass}
              value={event.event_status}
              onChange={(e) => set("event_status", e.target.value as EventFormValues["event_status"])}
            >
              <option value="upcoming">Not open yet</option>
              <option value="registration_open">Open for ticket purchases</option>
              <option value="registration_closed">Closed to ticket purchases</option>
              <option value="sold_out">Sold out</option>
              <option value="completed">Event completed</option>
              <option value="cancelled">Event cancelled</option>
            </select>
          </Field>
          <Field label="Sales open from" hint={openingTicket ? `Automatically follows the earliest scheduled ticket: ${openingTicket.name}. Change that ticket's Sales open date below.` : "Optional event-wide start. Individual tickets can have their own sale dates below."}>
            <input
              type="datetime-local"
              className={inputClass}
              value={registrationOpening}
              disabled={!!openingTicket}
              onChange={(e) => set("registration_start", e.target.value)}
            />
          </Field>
          <Field label="Sales close at" hint="Optional event-wide cutoff for every ticket. Individual tickets may close sooner.">
            <input
              type="datetime-local"
              className={inputClass}
              value={event.registration_end}
              onChange={(e) => set("registration_end", e.target.value)}
            />
          </Field>
          </div>
        </details>
      </section>

      {section === "settings" && <section className="space-y-3 rounded-2xl border border-border/60 bg-card p-6">
        <h2 className="font-display text-lg font-bold">Checkout and policies</h2>
        <p className="text-sm text-muted-foreground">Checkout currently allows up to 10 tickets per basket. Buyer and attendee details use the standard checkout fields.</p>
        <p className="text-sm text-muted-foreground">Per-event ticket limits, buyer and attendee field configuration, policies and consents, and confirmation/cancellation settings are not yet configurable.</p>
      </section>}

      <section hidden={!!section && section !== "content"} className="space-y-4 rounded-2xl border border-border/60 bg-card p-6">
        <h2 className="font-display text-lg font-bold">Speakers</h2>
        <p className="text-sm text-muted-foreground">Most speakers appear at one event. Add them here; no separate speaker-list step is needed. A workshop speaker is assigned separately in Programme and workshops.</p>
        <div className="space-y-4 rounded-xl border border-border bg-background p-4">
          <h3 className="font-semibold">Add a speaker for this event</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><input className={inputClass} value={speakerDraft.name} onChange={(e) => setSpeakerDraft((previous) => ({ ...previous, name: e.target.value }))} /></Field>
            <Field label="Role or job title"><input className={inputClass} value={speakerDraft.job_title} onChange={(e) => setSpeakerDraft((previous) => ({ ...previous, job_title: e.target.value }))} /></Field>
            <Field label="Company"><input className={inputClass} value={speakerDraft.company} onChange={(e) => setSpeakerDraft((previous) => ({ ...previous, company: e.target.value }))} /></Field>
          </div>
          {speakerDraft.photo_url && <div className="space-y-2"><img src={speakerDraft.photo_url} alt="New speaker portrait" className="h-32 w-32 rounded-xl object-cover" /><Button type="button" variant="outlineInk" size="sm" onClick={() => setSpeakerDraft((previous) => ({ ...previous, photo_url: "" }))}>Remove portrait</Button></div>}
          <AdminImageUpload scope="speaker-photos" label="Upload speaker portrait from your computer" onUploaded={(url) => setSpeakerDraft((previous) => ({ ...previous, photo_url: url }))} />
          <Field label="Short bio"><textarea className={textareaClass} value={speakerDraft.bio} onChange={(e) => setSpeakerDraft((previous) => ({ ...previous, bio: e.target.value }))} /></Field>
          <Button type="button" variant="outlineInk" disabled={speakerDraft.name.trim().length < 2} onClick={() => {
            setNewSpeakers((previous) => [...previous, { ...speakerDraft }]);
            setSpeakerDraft({ name: "", job_title: "", company: "", bio: "", photo_url: "" });
          }}>
            Add speaker to event draft
          </Button>
          <p className="text-xs text-muted-foreground">The speaker is saved only when you save the event. One-off speakers are not added to the reusable speaker list.</p>
        </div>
        {newSpeakers.length > 0 && <div className="space-y-2" aria-label="New speakers pending event save">
          {newSpeakers.map((speaker, index) => <div key={`${speaker.name}-${index}`} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"><span>{speaker.name} · pending event save</span><Button type="button" variant="ghost" size="sm" onClick={() => setNewSpeakers((previous) => previous.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button></div>)}
        </div>}
        {speakerIds.length > 0 && <p className="text-sm">Selected for this event: {speakers.filter((speaker: EventSpeakerOption) => speakerIds.includes(speaker.id)).map((speaker: EventSpeakerOption) => speaker.name).join(", ") || `${speakerIds.length} speaker(s)`}</p>}
        {event.id && speakers.filter((speaker: EventSpeakerOption) => speaker.event_id === event.id).map((speaker: EventSpeakerOption) => <EventOwnedSpeakerEditor key={speaker.id} eventId={event.id!} speaker={speaker} onDeleted={(id) => setSpeakerIds((previous) => previous.filter((item) => item !== id))} />)}
        <details className="rounded-xl border border-border p-4">
          <summary className="cursor-pointer text-sm font-medium">Choose or remove an existing speaker</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {speakers.map((speaker: EventSpeakerOption) => (
              <label key={speaker.id} className="flex items-center gap-3 text-sm">
                <input type="checkbox" checked={speakerIds.includes(speaker.id)} onChange={(e) => setSpeakerIds((previous) => e.target.checked ? [...previous, speaker.id] : previous.filter((id) => id !== speaker.id))} />
                {speaker.name}
              </label>
            ))}
          </div>
        </details>
      </section>

      <section hidden={!!section && section !== "tickets"} className="space-y-6 rounded-2xl border border-border/60 bg-card p-6">
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
            No ticket types yet. Add one to let attendees buy tickets and register.
          </p>
        )}
        <p className="text-sm text-muted-foreground">Saved ticket types shown here are active. Removing a saved type archives it when you save. Archived types cannot yet be restored here.</p>
        <details className="rounded-xl border border-border bg-background p-4 text-sm">
          <summary className="cursor-pointer font-semibold">Which benefits belong to each membership?</summary>
          <p className="mt-2 text-muted-foreground">These benefits belong to the plans, not this event. Ticket settings below can check or use an existing benefit; they cannot create one or change a plan.</p>
          {benefitsError ? <p className="mt-2 text-destructive">Membership-plan benefits could not be loaded. Check plan assignments before setting a restricted ticket.</p> : benefitMatrix.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {benefitMatrix.map((plan: EventBenefitPlan) => (
                <div key={plan.id} className="rounded-lg border border-border p-3">
                  <p className="font-medium">{plan.name}</p>
                  <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                    {(plan.plan_entitlements ?? []).map((benefit: EventBenefitPlan["plan_entitlements"][number]) => <li key={benefit.entitlements?.key ?? "unknown"}>{benefit.entitlements?.name ?? "Benefit"} · {describePlanBenefit(benefit.entitlements?.key ?? "", benefit.value)}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">You can <a href="/admin/plans" className="underline underline-offset-4">view membership plans</a> in Back Office. Benefit assignments are currently read-only there; an admin must review any change to promised benefits.</p>
        </details>
        {tickets.map((ticket, index) => (
          <div key={index} className="space-y-4 border-t border-border pt-5">
            <p className="text-xs text-muted-foreground">{ticket.id ? "Active ticket type" : "New ticket type · not saved"}</p>
            {ticket.id && <p className="text-sm text-muted-foreground" role="status">
              {initialTicketStats === null
                ? "Ticket sales statistics are unavailable."
                : initialTicketStats?.[ticket.id]
                ? `${initialTicketStats[ticket.id]!.ticketsSold} confirmed${ticket.capacity ? ` / ${ticket.capacity} capacity` : ""} · Recorded revenue ${Object.entries(initialTicketStats[ticket.id]!.revenueByCurrencyMinor).map(([currency, amount]) => formatMoney(amount / 100, currency)).join(" · ") || formatMoney(0, ticket.currency)}`
                : "0 confirmed · Recorded revenue —"}
            </p>}
            <p className="text-sm font-medium text-accent" role="status">
              {event.publish_state !== "published"
                ? "Not visible for purchase until this event is published."
                : ticketAvailabilityMessage(ticketAvailability({
                    registrationOpen: isRegistrationOpen({
                      status: event.event_status,
                      startDate: event.start_date,
                      registrationStart: event.registration_start || null,
                      registrationEnd: event.registration_end || null,
                    }),
                    soldOut: false,
                    saleStart: ticket.sale_start || null,
                    saleEnd: ticket.sale_end || null,
                    eligible: true,
                  }), ticket.sale_start || null, false) ?? "On sale now (subject to capacity and buyer eligibility)."}
            </p>
            <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr_auto]">
              <Field label="Name">
                <input
                  className={inputClass}
                  value={ticket.name}
                  onChange={(e) => setTicket(index, "name", e.target.value)}
                />
              </Field>
              <Field label="Public price">
                <input
                  type="number"
                  min={0}
                  step="0.01"
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
                aria-label={ticket.id ? "Archive ticket on save" : "Remove unsaved ticket"}
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
            <div className="space-y-3 rounded-xl border border-border bg-background p-4">
              <h3 className="font-semibold">When can people buy this ticket?</h3>
              <p className="text-xs text-muted-foreground">Leave both dates empty to use the event-wide sales dates in the dropdown above. The earliest ticket start also sets the event-wide sales opening.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Sales open"><input type="datetime-local" className={inputClass} value={ticket.sale_start} onChange={e=>setTicket(index,"sale_start",e.target.value)} /></Field>
                <Field label="Sales close"><input type="datetime-local" className={inputClass} value={ticket.sale_end} onChange={e=>setTicket(index,"sale_end",e.target.value)} /></Field>
              </div>
            </div>
            <div className="space-y-3 rounded-xl border border-border bg-background p-4">
              <h3 className="font-semibold">Who can buy this ticket?</h3>
              <p className="text-xs text-muted-foreground">The event can stay public while a particular ticket is reserved for eligible members.</p>
              <Field label="Buyer eligibility">
                <select className={inputClass} value={ticket.required_entitlement} onChange={e=>setTicket(index,"required_entitlement",e.target.value)}>
                  <option value="">Anyone (public ticket)</option>
                  {entitlements.map((ent: { key: string; name: string }) => <option key={ent.key} value={ent.key}>Only members with: {ent.name}</option>)}
                </select>
              </Field>
              {ticket.required_entitlement && benefitsLoading && <p className="text-xs text-muted-foreground">Checking which active plans include this benefit…</p>}
              {ticket.required_entitlement && !benefitsError && !benefitsLoading && <p className="text-xs text-muted-foreground">Eligible active plans: {benefitMatrix.filter((plan) => plan.plan_entitlements?.some((benefit) => benefit.entitlements?.key === ticket.required_entitlement)).map((plan) => plan.name).join(", ") || "none of the active plans — check before publishing"}.</p>}
            </div>
            <div className="space-y-3 rounded-xl border border-border bg-background p-4">
              <h3 className="font-semibold">What does a member pay?</h3>
              <p className="text-xs text-muted-foreground">Existing plan benefits are applied automatically for the event type. Outside workshops, an optional fixed member price is used only when it is better than the applicable percentage discount; free admission takes priority.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Fixed member price (optional)"><input type="number" min="0" step="0.01" className={inputClass} value={ticket.member_price} onChange={e=>setTicket(index,"member_price",e.target.value)} /></Field>
                <Field label="Currency"><select className={inputClass} value={ticket.currency} onChange={e=>setTicket(index,"currency",e.target.value)}>{["CHF","EUR","USD","GBP","CZK"].map(c=><option key={c}>{c}</option>)}</select></Field>
              </div>
              <details className="rounded-lg border border-border p-3">
                <summary className="cursor-pointer text-sm font-medium">Advanced: add a specific discount or free-ticket benefit{ticket.discount_entitlement || ticket.free_entitlement ? " · configured" : ""}</summary>
                <p className="mt-2 text-xs text-muted-foreground">Usually leave these empty. Only benefits relevant to this event type are offered. The member must have the selected benefit; workshop credit is handled automatically.</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <Field label="Extra percentage discount benefit">
                    <select className={inputClass} value={ticket.discount_entitlement} onChange={e=>setTicket(index,"discount_entitlement",e.target.value)}>
                      <option value="">No extra discount</option>
                      {entitlements.filter((ent: { key: string }) => ent.key === ticketBenefitKeys[event.event_type]?.discount || ent.key === ticket.discount_entitlement).map((ent: { key: string; name: string }) => <option key={ent.key} value={ent.key}>{ent.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Free-ticket benefit">
                    <select className={inputClass} value={ticket.free_entitlement} onChange={e=>setTicket(index,"free_entitlement",e.target.value)}>
                      <option value="">No extra free-ticket rule</option>
                      {entitlements.filter((ent: { key: string }) => ent.key === ticketBenefitKeys[event.event_type]?.free || ent.key === ticket.free_entitlement).map((ent: { key: string; name: string }) => <option key={ent.key} value={ent.key}>{ent.name}</option>)}
                    </select>
                  </Field>
                </div>
                {ticket.discount_entitlement && ticket.free_entitlement && <p className="mt-2 text-xs text-accent">Both are set. For members with both benefits, the free ticket takes priority.</p>}
              </details>
            </div>
          </div>
        ))}
      </section>

      <section hidden={!!section && section !== "content"} className="space-y-6 rounded-2xl border border-border/60 bg-card p-6">
        <div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold">Programme and workshops</h2><Button type="button" variant="outlineInk" size="sm" onClick={() => setWorkshops((previous) => [...previous, { ...emptyWorkshop }])}>Add workshop</Button></div>
        {workshops.length === 0 && <p className="text-sm text-muted-foreground">Optional. Add workshops or programme sessions shown on the public event page.</p>}
        {workshops.map((workshop, index) => <div key={workshop.id ?? index} className="space-y-4 border-t border-border pt-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Title"><input className={inputClass} value={workshop.title} onChange={(event) => setWorkshop(index, "title", event.target.value)} /></Field><Field label="Speaker"><select className={inputClass} value={workshop.speaker_id} onChange={(event) => setWorkshop(index, "speaker_id", event.target.value)}><option value="">No speaker</option>{speakers.map((speaker: EventSpeakerOption) => <option key={speaker.id} value={speaker.id}>{speaker.name}</option>)}</select></Field><Field label="Start"><input type="datetime-local" className={inputClass} value={workshop.start_time} onChange={(event) => setWorkshop(index, "start_time", event.target.value)} /></Field><Field label="End"><input type="datetime-local" className={inputClass} value={workshop.end_time} onChange={(event) => setWorkshop(index, "end_time", event.target.value)} /></Field><Field label="Location"><input className={inputClass} value={workshop.location} onChange={(event) => setWorkshop(index, "location", event.target.value)} /></Field><Field label="Capacity"><input type="number" min={1} className={inputClass} value={workshop.capacity} onChange={(event) => setWorkshop(index, "capacity", event.target.value)} /></Field></div><Field label="Description"><textarea className={textareaClass} value={workshop.description} onChange={(event) => setWorkshop(index, "description", event.target.value)} /></Field><div className="flex flex-wrap items-end justify-between gap-4"><Field label="Price (CHF)" className="w-40"><input type="number" min={0} className={inputClass} value={workshop.base_price} onChange={(event) => setWorkshop(index, "base_price", event.target.value)} /></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={workshop.separate_registration_required} onChange={(event) => setWorkshop(index, "separate_registration_required", event.target.checked)} />Separate registration required</label><button type="button" className="text-xs text-destructive underline" onClick={() => setWorkshops((previous) => previous.filter((_, workshopIndex) => workshopIndex !== index))}>Remove</button></div></div>)}
      </section>

      <p className="text-sm text-muted-foreground">Saving applies changes across Tickets, Settings and Edit content. Save before opening the public preview. Save draft also changes the publication state to draft.</p>
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
              if (confirm(`Delete "${event.title}"? Events with registrations cannot be deleted.`)) deleteMutation.mutate();
            }}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        )}
      </div>
    </form>
  );
}
