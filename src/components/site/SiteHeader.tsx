import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CometXLogo } from "./CometXLogo";

const NAV = [
  { to: "/events", label: "Events" },
  { to: "/membership", label: "Membership" },
  { to: "/community", label: "Community" },
  { to: "/partners", label: "Partners" },
  { to: "/about", label: "About" },
];

export function SiteHeader() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 lg:px-8">
        <CometXLogo />

        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                pathname.startsWith(item.to) && "text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {!loading && user ? (
            <Button asChild variant="ink" size="sm">
              <Link to="/account">My CometX</Link>
            </Button>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Log in
              </Link>
              <Button asChild variant="signal" size="sm">
                <Link to="/membership">Join CometX</Link>
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          className="md:hidden"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <div className="flex flex-col px-5 py-4">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="py-2.5 text-sm font-medium"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to={user ? "/account" : "/login"}
              onClick={() => setOpen(false)}
              className="py-2.5 text-sm font-medium"
            >
              {user ? "My CometX" : "Log in"}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
