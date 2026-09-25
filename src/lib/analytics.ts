export function trackEvent(name: string, parameters: Record<string, string | number | boolean | undefined> = {}) {
  if (typeof window === "undefined") return;
  const analyticsWindow = window as unknown as Window & { dataLayer?: unknown[] };
  const dataLayer = analyticsWindow.dataLayer ?? [];
  analyticsWindow.dataLayer = dataLayer;
  dataLayer.push({ event: name, ...parameters });
}

export function initializeAnalytics() {
  if (typeof window === "undefined") return;
  const analyticsWindow = window as unknown as Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
  const gtmContainerId = import.meta.env["VITE_GTM_CONTAINER_ID"];
  const gaMeasurementId = import.meta.env["VITE_GA_MEASUREMENT_ID"];
  const scriptId = gtmContainerId ? "cometx-gtm" : "cometx-ga";
  if (document.getElementById(scriptId)) return;
  analyticsWindow.dataLayer ??= [];
  if (gtmContainerId) {
    analyticsWindow.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmContainerId)}`;
    document.head.append(script);
    return;
  }
  if (gaMeasurementId) {
    analyticsWindow.gtag = (...args) => analyticsWindow.dataLayer?.push(args);
    analyticsWindow.gtag("js", new Date());
    analyticsWindow.gtag("config", gaMeasurementId);
    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`;
    document.head.append(script);
  }
}
