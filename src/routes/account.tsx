import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { LoadingBlock, Section } from "@/components/site/Bits";
import { useLanguage } from "@/contexts/LanguageContext";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My CometX" },
      { name: "description", content: "Your CometX membership, registrations and profile." },
      { property: "og:title", content: "My CometX" },
      { property: "og:description", content: "Manage your membership, tickets and profile." },
    ],
  }),
  component: AccountLayout,
});

function AccountLayout() {
  const { language } = useLanguage();
  const cs = language === "cs";
  const tabs = [
    { to: "/account", label: cs ? "Přehled" : "Overview", exact: true },
    { to: "/account/events", label: cs ? "Moje akce" : "My events", exact: false },
    { to: "/account/membership", label: cs ? "Členství" : "Membership", exact: false },
    { to: "/account/profile", label: cs ? "Profil" : "Profile", exact: false },
  ] as const;
  const { user, loading, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", search: { redirect: "/account" } });
  }, [loading, user, navigate]);

  if (loading || !user)
    return (
      <Section>
        <LoadingBlock label={cs ? "Ověřujeme přihlášení" : "Checking your session"} />
      </Section>
    );

  return (
    <>
      <div className="relative overflow-hidden border-b border-ink-foreground/15 bg-ink text-ink-foreground">
        <div aria-hidden="true" className="absolute inset-y-0 right-0 w-2 bg-accent" />
        <div className="relative mx-auto max-w-7xl px-5 pt-12 lg:px-8">
          <p className="eyebrow text-accent">{cs ? "Členská sekce" : "Members area"}</p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            {cs ? "Můj CometX" : "My CometX"}
          </h1>
          <nav className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
            <button
              className="border-b-2 border-transparent pb-3 text-sm font-medium text-ink-foreground/65 hover:text-ink-foreground"
              disabled={signingOut}
              onClick={async () => {
                setSigningOut(true);
                try {
                  await signOut();
                  await navigate({ to: "/login" });
                } catch {
                  toast.error(
                    cs
                      ? "Odhlášení se nezdařilo. Zkuste to znovu."
                      : "Could not log out. Please try again.",
                  );
                } finally {
                  setSigningOut(false);
                }
              }}
            >
              {signingOut
                ? cs
                  ? "Odhlašujeme…"
                  : "Logging out..."
                : cs
                  ? "Odhlásit se"
                  : "Log out"}
            </button>
            {tabs.map((tab) => (
              <Link
                key={tab.to}
                to={tab.to}
                activeOptions={{ exact: tab.exact ?? false }}
                className="border-b-2 border-transparent pb-3 text-sm font-medium text-ink-foreground/65 transition-colors hover:text-ink-foreground [&.active]:border-accent [&.active]:text-accent"
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <Outlet />
    </>
  );
}
