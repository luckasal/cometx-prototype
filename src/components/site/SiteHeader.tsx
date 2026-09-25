import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Languages, Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CometXLogo } from "./CometXLogo";
import { useLanguage } from "@/contexts/LanguageContext";

const NAV = [
  { to: "/events", en: "Events", cs: "Akce" },
  { to: "/membership", en: "Membership", cs: "Členství" },
  { to: "/community", en: "Community", cs: "Komunita" },
  { to: "/partners", en: "Partners", cs: "Partneři" },
  { to: "/about", en: "About", cs: "O nás" },
  { to: "/get-involved", en: "Get involved", cs: "Zapojte se" },
] as const;

export function SiteHeader() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const { language, toggleLanguage } = useLanguage();
  const cs = language === "cs";
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="sticky top-0 z-50 border-b border-ink-foreground/10 bg-ink/95 text-ink-foreground backdrop-blur">
      <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-4 px-5 lg:px-8">
        <CometXLogo />

        <nav className="hidden items-center gap-6 xl:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "text-sm font-medium text-ink-foreground/70 transition-colors hover:text-accent",
                pathname.startsWith(item.to) && "text-accent",
              )}
            >
              {item[language]}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 xl:flex">
          <button type="button" onClick={toggleLanguage} className="inline-flex items-center gap-1.5 border border-ink-foreground/25 px-2.5 py-1.5 text-xs font-bold hover:border-accent hover:text-accent" aria-label={cs ? "Switch to English" : "Přepnout do češtiny"}>
            <Languages className="size-3.5" /> {cs ? "EN" : "CZ"}
          </button>
          {!loading && user ? (
            <Button asChild variant="ink" size="sm">
              <Link to="/account">{cs ? "Můj CometX" : "My CometX"}</Link>
            </Button>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-medium text-ink-foreground/70 hover:text-accent"
              >
                {cs ? "Přihlásit" : "Log in"}
              </Link>
              <Button asChild variant="signal" size="sm">
                <Link to="/membership">{cs ? "Přidat se" : "Join CometX"}</Link>
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          className="text-ink-foreground xl:hidden"
          aria-label={cs ? "Otevřít menu" : "Toggle menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-ink-foreground/15 bg-ink text-ink-foreground xl:hidden">
          <div className="flex flex-col px-5 py-4">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="py-2.5 text-sm font-medium"
              >
                {item[language]}
              </Link>
            ))}
            <Link
              to={user ? "/account" : "/login"}
              onClick={() => setOpen(false)}
              className="py-2.5 text-sm font-medium"
            >
              {user ? (cs ? "Můj CometX" : "My CometX") : (cs ? "Přihlásit" : "Log in")}
            </Link>
            <button type="button" onClick={toggleLanguage} className="mt-2 inline-flex items-center gap-2 border-t border-ink-foreground/15 py-3 text-left text-sm font-bold text-accent"><Languages className="size-4" />{cs ? "English" : "Česky"}</button>
          </div>
        </div>
      )}
    </header>
  );
}
