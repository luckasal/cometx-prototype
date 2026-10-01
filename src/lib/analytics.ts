type AnalyticsValue = string | number | boolean | undefined;
type AnalyticsParameters = Record<string, AnalyticsValue>;
type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

const allowedParameters = new Set([
  "event_slug", "event_id", "event_type", "ticket_type", "ticket_type_id", "membership_tier", "quantity", "value",
  "currency", "event_count", "cart_value", "pricing_type", "error_type", "placement", "plan", "partner_id", "destination", "method",
]);
let lastPageLocation: string | null = null;
const consentKey = "cometx-analytics-consent-v1";

export type AnalyticsConsentChoice = "granted" | "denied";

export function analyticsConfigured(): boolean {
  return Boolean(analyticsConfig().gaId);
}

export function getAnalyticsConsent(): AnalyticsConsentChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(consentKey);
    return stored === "granted" || stored === "denied" ? stored : null;
  } catch {
    return null;
  }
}

export function setAnalyticsConsent(choice: AnalyticsConsentChoice): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(consentKey, choice); }
  catch { /* Storage can be unavailable in private browsing. */ }
  const { gaId } = analyticsConfig();
  if (gaId) (window as unknown as Record<string, unknown>)[`ga-disable-${gaId}`] = choice !== "granted";
  window.dispatchEvent(new Event("cometx-analytics-consent-changed"));
}

/** Private guest-ticket tokens and other query values must never reach analytics. */
export function sanitizeAnalyticsLocation(url: string): string {
  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname}`;
}

function safeReferrer(): string {
  if (lastPageLocation) return lastPageLocation;
  try { return document.referrer ? sanitizeAnalyticsLocation(document.referrer) : ""; }
  catch { return ""; }
}

function analyticsConfig() {
  return { gaId: import.meta.env["VITE_GA_MEASUREMENT_ID"] as string | undefined };
}

function safeParameters(parameters: AnalyticsParameters): AnalyticsParameters {
  return Object.fromEntries(Object.entries(parameters).filter(([key, value]) =>
    allowedParameters.has(key) && value !== undefined &&
    (typeof value === "number" ? Number.isFinite(value) : typeof value === "boolean" ||
      (typeof value === "string" && value.length <= 200 && !value.includes("@"))),
  ));
}

export function trackEvent(name: string, parameters: AnalyticsParameters = {}): void {
  if (typeof window === "undefined" || getAnalyticsConsent() !== "granted" || window.location.pathname.startsWith("/admin")) return;
  const { gaId } = analyticsConfig();
  if (!gaId) return;
  initializeAnalytics();
  const analyticsWindow = window as AnalyticsWindow;
  const payload = {
    ...safeParameters(parameters),
    page_location: sanitizeAnalyticsLocation(window.location.href),
    page_referrer: safeReferrer(),
  };
  analyticsWindow.gtag?.("event", name, payload);
}

/** Dedupe one confirmed outcome per checkout key for the current browser tab. */
export function trackEventOnce(name: string, dedupeKey: string, parameters: AnalyticsParameters = {}): void {
  if (typeof window === "undefined" || !dedupeKey || getAnalyticsConsent() !== "granted" ||
    window.location.pathname.startsWith("/admin") || !analyticsConfig().gaId) return;
  const storageKey = `cometx-ga-event-v1:${name}:${dedupeKey}`;
  try {
    if (window.localStorage.getItem(storageKey)) return;
  } catch {
    trackEvent(name, parameters);
    return;
  }
  trackEvent(name, parameters);
  try { window.localStorage.setItem(storageKey, "1"); }
  catch { /* Tracking must not affect the checkout result. */ }
}

export function ticketPricingType(price: { benefitType: string; includedInMembership: boolean }): "public" | "member" | "included" {
  if (price.includedInMembership || price.benefitType === "free") return "included";
  return price.benefitType === "public" ? "public" : "member";
}

/** Capture external-link intent without sending link paths, invite codes, or query parameters. */
export function trackOutboundClick(event: MouseEvent): void {
  if (typeof window === "undefined" || !(event.target instanceof Element)) return;
  const anchor = event.target.closest("a[href]");
  if (!anchor) return;
  let target: URL;
  try { target = new URL(anchor.getAttribute("href") ?? "", window.location.href); }
  catch { return; }
  if (!/^https?:$/.test(target.protocol) || target.hostname === window.location.hostname) return;
  trackEvent("outbound_link", { destination: target.hostname });
  if (target.hostname === "wa.me" || target.hostname === "whatsapp.com" || target.hostname.endsWith(".whatsapp.com")) {
    trackEvent("whatsapp_click", { destination: target.hostname });
  }
}

/** Track a partner referral with a stable record ID and hostname only. */
export function trackPartnerClick(partnerId: string, href: string): void {
  if (typeof window === "undefined" || !partnerId || partnerId.length > 200) return;
  let target: URL;
  try { target = new URL(href, window.location.href); }
  catch { return; }
  if (!/^https?:$/.test(target.protocol) || target.hostname === window.location.hostname) return;
  trackEvent("partner_click", { partner_id: partnerId, destination: target.hostname });
}

export function trackPageView(pathname: string): void {
  if (typeof window === "undefined") return;
  if (pathname.startsWith("/admin")) { lastPageLocation = null; return; }
  if (getAnalyticsConsent() !== "granted") return;
  const { gaId } = analyticsConfig();
  if (!gaId) return;
  initializeAnalytics();
  const location = sanitizeAnalyticsLocation(new URL(pathname, window.location.origin).href);
  if (location === lastPageLocation) return;
  const payload = {
    page_title: document.title,
    page_location: location,
    page_referrer: safeReferrer(),
  };
  lastPageLocation = location;
  const analyticsWindow = window as AnalyticsWindow;
  analyticsWindow.gtag?.("event", "page_view", payload);
}

export function initializeAnalytics(): void {
  if (typeof window === "undefined" || getAnalyticsConsent() !== "granted" || window.location.pathname.startsWith("/admin")) return;
  const analyticsWindow = window as AnalyticsWindow;
  const { gaId } = analyticsConfig();
  if (!gaId) return;
  const scriptId = "cometx-ga";
  if (document.getElementById(scriptId)) return;
  analyticsWindow.dataLayer ??= [];
  const script = document.createElement("script");
  script.id = scriptId;
  script.async = true;
  script.referrerPolicy = "no-referrer";
  analyticsWindow.gtag = (...args) => analyticsWindow.dataLayer?.push(args);
  analyticsWindow.gtag("js", new Date());
  analyticsWindow.gtag("config", gaId, {
    send_page_view: false,
    page_location: sanitizeAnalyticsLocation(window.location.href),
    page_referrer: safeReferrer(),
  });
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
  document.head.append(script);
}

type PurchaseOrder = {
  id: string;
  status: string;
  amount_minor: number;
  currency: string;
  ticket_order_items: {
    event_id: string;
    ticket_type_id?: string;
    ticket_name?: string;
    events?: { slug?: string }[];
    quantity: number;
    ticket_attendees: { status: string }[];
  }[];
  payments: { status: string }[];
};

/** Only a paid, confirmed order with one issued ticket per attendee is a purchase. */
export function purchaseMetadata(orders: readonly PurchaseOrder[]): Record<string, string | number> | null {
  if (!orders.length || orders.some((order) => order.status !== "confirmed" || !order.ticket_order_items?.length ||
    !order.payments?.some((payment) => payment.status === "paid"))) return null;
  const currency = orders[0]!.currency.toUpperCase();
  if (orders.some((order) => order.currency.toUpperCase() !== currency)) return null;
  const lines = orders.flatMap((order) => order.ticket_order_items);
  if (lines.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1 ||
    line.ticket_attendees.filter((ticket) => ticket.status === "valid" || ticket.status === "checked_in").length < line.quantity)) return null;
  const amountMinor = orders.reduce((sum, order) => sum + Number(order.amount_minor), 0);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return null;
  const metadata: Record<string, string | number> = {
    value: amountMinor / 100,
    currency,
    quantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    event_count: new Set(lines.map((line) => line.event_id)).size,
  };
  const eventIds = new Set(lines.map((line) => line.event_id));
  const ticketIds = new Set(lines.flatMap((line) => line.ticket_type_id ? [line.ticket_type_id] : []));
  const eventSlugs = new Set(lines.flatMap((line) => line.events?.[0]?.slug ? [line.events[0].slug] : []));
  const ticketNames = new Set(lines.flatMap((line) => line.ticket_name ? [line.ticket_name] : []));
  if (eventIds.size === 1) metadata["event_id"] = [...eventIds][0]!;
  if (eventSlugs.size === 1) metadata["event_slug"] = [...eventSlugs][0]!;
  if (ticketIds.size === 1) metadata["ticket_type_id"] = [...ticketIds][0]!;
  if (ticketNames.size === 1) metadata["ticket_type"] = [...ticketNames][0]!;
  return metadata;
}

/** Emit payment failure only when the app reads a failed payment recorded by the server/webhook. */
export function trackConfirmedPaymentFailure(paymentKey: string, orders: readonly PurchaseOrder[]): void {
  if (!paymentKey || !orders.length || !orders.some((order) => order.payments?.some((payment) => payment.status === "failed"))) return;
  const lines = orders.flatMap((order) => order.ticket_order_items ?? []);
  const currencies = new Set(orders.map((order) => order.currency.toUpperCase()));
  const eventIds = new Set(lines.map((line) => line.event_id));
  const slugs = new Set(lines.flatMap((line) => line.events?.[0]?.slug ? [line.events[0].slug] : []));
  const ticketIds = new Set(lines.flatMap((line) => line.ticket_type_id ? [line.ticket_type_id] : []));
  const names = new Set(lines.flatMap((line) => line.ticket_name ? [line.ticket_name] : []));
  const value = orders.reduce((sum, order) => sum + Number(order.amount_minor), 0) / 100;
  const params: AnalyticsParameters = {
    quantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    event_count: eventIds.size,
    ...(Number.isFinite(value) && value > 0 ? { value, cart_value: value } : {}),
    ...(currencies.size === 1 ? { currency: [...currencies][0] } : {}),
    ...(eventIds.size === 1 ? { event_id: [...eventIds][0] } : {}),
    ...(slugs.size === 1 ? { event_slug: [...slugs][0] } : {}),
    ...(ticketIds.size === 1 ? { ticket_type_id: [...ticketIds][0] } : {}),
    ...(names.size === 1 ? { ticket_type: [...names][0] } : {}),
  };
  trackEventOnce("payment_failed", paymentKey, params);
}

/** A Stripe return URL alone is not proof of payment; callers pass server-confirmed orders. */
export function trackConfirmedPurchase(purchaseKey: string, orders: readonly PurchaseOrder[]): void {
  if (typeof window === "undefined" || getAnalyticsConsent() !== "granted" || !purchaseKey || !analyticsConfig().gaId) return;
  const metadata = purchaseMetadata(orders);
  if (!metadata) return;
  const storageKey = `cometx-ga-purchase-v1:${purchaseKey}`;
  try {
    if (window.localStorage.getItem(storageKey)) return;
    window.localStorage.setItem(storageKey, "1");
  } catch { /* Analytics must never block access to purchased tickets. */ }
  trackEvent("purchase", metadata);
}
