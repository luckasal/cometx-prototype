export type EventLifecycleFields = {
  publish_state: string;
  event_status: string;
};

export type EventLifecycleStatus = "draft" | "published" | "unpublished" | "completed" | "cancelled";

/** Completed and cancelled describe the event lifecycle; publication remains a separate field. */
export function getEventLifecycleStatus(event: EventLifecycleFields): EventLifecycleStatus {
  if (event.event_status === "completed" || event.event_status === "cancelled") return event.event_status;
  if (event.publish_state === "published" || event.publish_state === "unpublished") return event.publish_state;
  return "draft";
}

export function formatEventLifecycleStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}
