import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  analyticsConfigured,
  getAnalyticsConsent,
  initializeAnalytics,
  setAnalyticsConsent,
  trackPageView,
  type AnalyticsConsentChoice,
} from "@/lib/analytics";

export function AnalyticsConsent() {
  const { language } = useLanguage();
  const cs = language === "cs";
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [choice, setChoice] = useState<AnalyticsConsentChoice | null>(null);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const sync = () => setChoice(getAnalyticsConsent());
    const open = () => setEditing(true);
    const storageChanged = () => {
      sync();
      if (getAnalyticsConsent() === "granted") {
        initializeAnalytics();
        trackPageView(window.location.pathname);
      } else if (document.getElementById("cometx-ga") || document.getElementById("cometx-gtm")) {
        window.location.reload();
      }
    };
    sync();
    setReady(true);
    window.addEventListener("cometx-analytics-consent-changed", sync);
    window.addEventListener("cometx-analytics-preferences-open", open);
    window.addEventListener("storage", storageChanged);
    return () => {
      window.removeEventListener("cometx-analytics-consent-changed", sync);
      window.removeEventListener("cometx-analytics-preferences-open", open);
      window.removeEventListener("storage", storageChanged);
    };
  }, []);

  if (!ready || !analyticsConfigured() || pathname.startsWith("/admin") || (choice && !editing))
    return null;

  function choose(next: AnalyticsConsentChoice) {
    const wasGranted = choice === "granted";
    setAnalyticsConsent(next);
    setChoice(next);
    setEditing(false);
    if (next === "granted") {
      initializeAnalytics();
      trackPageView(window.location.pathname);
    } else if (wasGranted) {
      window.location.reload(); // Remove already-loaded GTM/GA scripts after withdrawal.
    }
  }

  return (
    <aside
      aria-label={cs ? "Nastavení analytiky" : "Analytics preference"}
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-xl rounded-2xl border border-border bg-card p-5 shadow-2xl"
    >
      <p className="text-sm text-card-foreground">
        {cs
          ? "Můžeme použít analytické cookies, abychom porozuměli návštěvnosti a zlepšovali CometX? Bez vašeho souhlasu analytiku nespouštíme."
          : "May we use analytics cookies to understand visits and improve CometX? Analytics stays off unless you agree."}
      </p>
      <a
        className="mt-2 inline-block text-xs underline underline-offset-2"
        href="https://www.cometx.ch/_files/ugd/41f758_cf8654296bfe4790be7ac44abfe07fbd.pdf"
        target="_blank"
        rel="noreferrer noopener"
      >
        {cs ? "Ochrana soukromí" : "Privacy notice"}
      </a>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-full border border-border px-4 py-2 text-sm text-card-foreground"
          onClick={() => choose("denied")}
        >
          {cs ? "Odmítnout" : "Decline"}
        </button>
        <button
          type="button"
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
          onClick={() => choose("granted")}
        >
          {cs ? "Povolit analytiku" : "Allow analytics"}
        </button>
      </div>
    </aside>
  );
}

export function AnalyticsPreferenceButton() {
  const { language } = useLanguage();
  if (!analyticsConfigured()) return null;
  return (
    <button
      type="button"
      className="hover:text-accent"
      onClick={() => window.dispatchEvent(new Event("cometx-analytics-preferences-open"))}
    >
      {language === "cs" ? "Nastavení analytiky" : "Analytics settings"}
    </button>
  );
}
