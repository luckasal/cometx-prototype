type AnalyticsValue = string | number | boolean | undefined;
type AnalyticsParameters = Record<string, AnalyticsValue>;
type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

const allowedParameters = new Set([
  "event_slug", "event_id", "event_type", "ticket_type", "ticket_type_id", "membership_tier", "quantity", "value",
  "currency", "event_count", "placement", "plan", "partner_id", "destination", "method",
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
    quantity: number;
    ticket_attendees: { status: string }[];
  }[];
  payments: { status: string }[];
};

/** Only a paid, confirmed order with one issued ticket per attendee is a purchase. */
export function purchaseMetadata(orders: readonly PurchaseOrder[]): { value: number; currency: string; quantity: number; event_count: number } | null {
  if (!orders.length || orders.some((order) => order.status !== "confirmed" || !order.ticket_order_items?.length ||
    !order.payments?.some((payment) => payment.status === "paid"))) return null;
  const currency = orders[0]!.currency.toUpperCase();
  if (orders.some((order) => order.currency.toUpperCase() !== currency)) return null;
  const lines = orders.flatMap((order) => order.ticket_order_items);
  if (lines.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1 ||
    line.ticket_attendees.filter((ticket) => ticket.status === "valid" || ticket.status === "checked_in").length < line.quantity)) return null;
  const amountMinor = orders.reduce((sum, order) => sum + Number(order.amount_minor), 0);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return null;
  return {
    value: amountMinor / 100,
    currency,
    quantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    event_count: new Set(lines.map((line) => line.event_id)).size,
  };
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
