/** Checkout redirects come from deployment configuration, never user input. */
export function checkoutOrigin(configured: string | undefined): string {
  if (!configured) throw new Error("SITE_URL must be configured before checkout.");
  const url = new URL(configured);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) {
    throw new Error("SITE_URL must use HTTPS, or HTTP on localhost.");
  }
  return url.origin;
}

export function isPaidCheckout(session: { payment_status?: string | undefined; livemode?: boolean | undefined }): boolean {
  return session.payment_status === "paid" && session.livemode === false;
}
