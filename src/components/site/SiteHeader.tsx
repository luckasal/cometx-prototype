import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Languages, Menu, ShoppingCart, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CometXLogo } from "./CometXLogo";
import { useLanguage } from "@/contexts/LanguageContext";
import { readTicketCart, ticketCartCount, ticketCartCountLabel } from "@/lib/ticket-cart";

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
  const [cartCount, setCartCount] = useState(0);
  const { language, toggleLanguage } = useLanguage();
  const cs = language === "cs";
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const update = () => setCartCount(ticketCartCount(readTicketCart()));
    update();
    window.addEventListener("storage", update);
    window.addEventListener("cometx-ticket-cart-change", update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("cometx-ticket-cart-change", update);
    };
  }, []);

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
          <button type="button" onClick={toggleLanguage} className="inline-flex items-center gap-1.5 rounded-full border border-ink-foreground/25 px-2.5 py-1.5 text-xs font-bold hover:border-accent hover:text-accent" aria-label={cs ? "Switch to English" : "Přepnout do češtiny"}>
            <Languages className="size-3.5" /> {cs ? "EN" : "CZ"}
          </button>
          {!loading && (user ? (
            <Button asChild variant="ink" size="sm">
              <Link to="/account">{cs ? "Můj CometX" : "My CometX"}</Link>
            </Button>
          ) : (
              <Link
                to="/login"
                className="text-sm font-medium text-ink-foreground/70 hover:text-accent"
              >
                {cs ? "Přihlásit" : "Log in"}
              </Link>
          ))}
          <Link to="/cart" title={`${cs ? "Košík" : "Cart"}: ${ticketCartCountLabel(cartCount, cs)}`} aria-label={`${cs ? "Košík" : "Cart"}: ${ticketCartCountLabel(cartCount, cs)}`} className={cn("relative grid size-9 place-items-center rounded-full text-ink-foreground/75 transition-colors hover:bg-ink-foreground/5 hover:text-accent", pathname === "/cart" && "text-accent")}>
            <ShoppingCart className="size-4" />
            <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-accent text-[10px] leading-none font-bold text-accent-foreground">{cartCount}</span>
          </Link>
          {!loading && !user && <Button asChild variant="signal" size="sm"><Link to="/membership">{cs ? "Přidat se" : "Join CometX"}</Link></Button>}
        </div>

        <Link to="/cart" className="relative ml-auto inline-flex items-center gap-1 rounded-full p-2 text-ink-foreground hover:text-accent xl:hidden" aria-label={`${cs ? "Košík" : "Cart"}: ${ticketCartCountLabel(cartCount, cs)}`}>
          <ShoppingCart className="size-5" />
          <span className="min-w-5 rounded-full bg-accent px-1.5 py-0.5 text-center text-[10px] font-bold text-accent-foreground">{cartCount}</span>
        </Link>

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
