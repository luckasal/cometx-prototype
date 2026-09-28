/** Explicit deployment settings; never derive checkout origins from request headers. */
export function configuredAppUrl(env: Record<string, string | undefined>): string | undefined {
  return env["APP_URL"]?.trim() || env["SITE_URL"]?.trim() || undefined;
}

export function ticketEmailEnabled(env: Record<string, string | undefined>): boolean {
  const mode = env["TICKET_EMAIL_MODE"] ?? "disabled";
  if (mode !== "disabled" && mode !== "enabled") throw new Error("TICKET_EMAIL_MODE must be enabled or disabled.");
  if (mode === "enabled" && (!env["RESEND_API_KEY"] || !env["RESEND_FROM_EMAIL"])) {
    throw new Error("Ticket email delivery requires a verified sender and API key.");
  }
  return mode === "enabled";
}
