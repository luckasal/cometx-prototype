/** Keep internal sample records out of public discovery without changing their admin data. */
export function isPublicEventListingCandidate(event: { slug: string }) {
  return event.slug !== "new-demo-event";
}
