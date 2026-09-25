import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAccountOverview } from "@/lib/membership.functions";
import { useAuth } from "@/hooks/useAuth";
import { ErrorBlock, LoadingBlock } from "@/components/site/Bits";
import { CometXLogo } from "@/components/site/CometXLogo";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "CometX back office" },
      { name: "description", content: "Internal CometX content and membership administration." },
      { property: "og:title", content: "CometX back office" },
      { property: "og:description", content: "Internal administration for CometX staff." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

const nav = [
  { to: "/admin", label: "Dashboard", exact: true },
  { to: "/admin/events", label: "Events", exact: false },
  { to: "/admin/members", label: "Members", exact: false },
  { to: "/admin/contacts", label: "Contacts", exact: false },
  { to: "/admin/registrations", label: "Registrations", exact: false },
  { to: "/admin/plans", label: "Memberships", exact: false },
  { to: "/admin/newsletter", label: "Newsletter", exact: false },
  { to: "/admin/payments", label: "Payments", exact: false },
  { to: "/admin/content", label: "Content", exact: false },
  { to: "/admin/partners", label: "Partners", exact: false },
  { to: "/admin/settings", label: "Settings", exact: false },
] as const;

function AdminLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fetchOverview = useServerFn(getAccountOverview);
  const { data, isLoading, error } = useQuery({
    queryKey: ["account"],
    queryFn: () => fetchOverview(),
    enabled: !!user,
  });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", search: { redirect: "/admin" } });
  }, [loading, user, navigate]);

  if (loading || isLoading || !user)
    return (
      <div className="mx-auto max-w-7xl px-5 py-20">
        <LoadingBlock label="Checking your access" />
      </div>
    );

  if (error) return <div className="mx-auto max-w-lg p-10"><ErrorBlock error={error} /></div>;

  if (!data?.isAdmin)
    return (
      <div className="mx-auto max-w-md px-5 py-28 text-center">
        <h1 className="display-lg">Staff only</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Your account does not have administrator access.
        </p>
        <Link to="/account" className="mt-6 inline-block underline underline-offset-4">
          Back to My CometX
        </Link>
      </div>
    );

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-ink text-ink-foreground lg:flex">
        <div className="border-b border-ink-foreground/15 px-6 py-5">
          <CometXLogo />
          <p className="eyebrow mt-1 text-ink-foreground/50">Back office</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact }}
              className="block px-3 py-2 text-sm text-ink-foreground/70 transition-colors hover:bg-ink-foreground/10 hover:text-ink-foreground [&.active]:bg-accent [&.active]:text-accent-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-ink-foreground/15 px-6 py-4 text-xs text-ink-foreground/50">
          {data?.profile.email}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex gap-4 overflow-x-auto border-b border-border bg-ink px-4 py-3 text-ink-foreground lg:hidden">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact }}
              className="whitespace-nowrap text-xs text-ink-foreground/70 [&.active]:text-accent"
            >
              {item.label}
            </Link>
          ))}
        </div>
        <Outlet />
      </div>
    </div>
  );
}
