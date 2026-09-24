import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { LoadingBlock, Section } from "@/components/site/Bits";

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

const tabs = [
  { to: "/account", label: "Overview", exact: true },
  { to: "/account/events", label: "My events", exact: false },
  { to: "/account/membership", label: "Membership", exact: false },
  { to: "/account/profile", label: "Profile", exact: false },
] as const;

function AccountLayout() {
  const { user, loading, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", search: { redirect: "/account" } });
  }, [loading, user, navigate]);

  if (loading || !user)
    return (
      <Section>
        <LoadingBlock label="Checking your session" />
      </Section>
    );

  return (
    <>
      <div className="border-b border-border bg-paper">
        <div className="mx-auto max-w-7xl px-5 pt-14 lg:px-8">
          <p className="eyebrow text-muted-foreground">Members area</p>
          <h1 className="display-lg mt-3">My CometX</h1>
          <nav className="mt-8 flex flex-wrap gap-6">
            <button className="pb-3 text-sm font-medium text-muted-foreground hover:text-foreground" disabled={signingOut} onClick={async () => {
              setSigningOut(true);
              try { await signOut(); await navigate({ to: "/login" }); }
              catch { toast.error("Could not log out. Please try again."); }
              finally { setSigningOut(false); }
            }}>{signingOut ? "Logging out..." : "Log out"}</button>
            {tabs.map((tab) => (
              <Link
                key={tab.to}
                to={tab.to}
                activeOptions={{ exact: tab.exact ?? false }}
                className="border-b-2 border-transparent pb-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground [&.active]:border-accent [&.active]:text-foreground"
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
