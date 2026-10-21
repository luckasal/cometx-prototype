import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminAccess } from "@/lib/admin-access.functions";
import { adminListMembers, adminListEvents, adminListContacts } from "@/lib/admin.functions";
import { withRequestTimeout } from "@/lib/request-timeout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { ErrorBlock, LoadingBlock } from "@/components/site/Bits";
import { CometXLogo } from "@/components/site/CometXLogo";
import { staffRoutePermission } from "@/lib/staff-permissions";
import { StaffReadOnly } from "@/components/admin/StaffReadOnly";

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
  { to: "/admin/analytics", label: "Website analytics", exact: false },
  { to: "/admin/events", label: "Events", exact: false },
  { to: "/admin/members", label: "Members", exact: false },
  { to: "/admin/contacts", label: "Contacts", exact: false },
  { to: "/admin/orders", label: "Orders & attendees", exact: false },
  { to: "/admin/plans", label: "Memberships", exact: false },
  { to: "/admin/newsletter", label: "Newsletter", exact: false },
  { to: "/admin/payments", label: "Payments", exact: false },
  { to: "/admin/content", label: "Content", exact: false },
  { to: "/admin/articles", label: "Articles", exact: false },
  { to: "/admin/speakers", label: "Speakers", exact: false },
  { to: "/admin/partners", label: "Partners", exact: false },
  { to: "/admin/settings", label: "Settings", exact: false },
] as const;

function AdminLayout() {
  const { user, loading, error: authError } = useAuth();
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const cache = useQueryClient();
  const fetchMembers = useServerFn(adminListMembers);
  const fetchEvents = useServerFn(adminListEvents);
  const fetchContacts = useServerFn(adminListContacts);
  const fetchAccess = useServerFn(getAdminAccess);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "access", user?.id],
    queryFn: () =>
      withRequestTimeout(fetchAccess(), 15000, "The access check took too long. Please try again."),
    enabled: !!user,
    retry: false,
  });

  useEffect(() => {
    if (!user || loading || authError) return;
    // These are independently protected server functions. Start the selected
    // page's read alongside the access gate, without exposing its UI or records.
    if (pathname === "/admin/members") {
      void cache.prefetchQuery({
        queryKey: ["admin", "members"],
        queryFn: () =>
          withRequestTimeout(
            fetchMembers(),
            15000,
            "Loading members took too long. Please try again.",
          ),
        retry: false,
      });
    } else if (pathname === "/admin/events" || pathname === "/admin/events/") {
      void cache.prefetchQuery({
        queryKey: ["admin", "events"],
        queryFn: () =>
          withRequestTimeout(
            fetchEvents(),
            15000,
            "Loading events took too long. Please try again.",
          ),
        retry: false,
      });
    } else if (pathname === "/admin/contacts") {
      void cache.prefetchQuery({
        queryKey: ["admin", "contacts", "", "all"],
        queryFn: () =>
          withRequestTimeout(
            fetchContacts({ data: { query: "", status: "all" } }),
            15000,
            "Loading contacts took too long. Please try again.",
          ),
        retry: false,
      });
    }
  }, [user, loading, authError, pathname, cache, fetchMembers, fetchEvents, fetchContacts]);

  useEffect(() => {
    if (!loading && !authError && !user) navigate({ to: "/login", search: { redirect: "/admin" } });
  }, [loading, authError, user, navigate]);

  if (authError || error)
    return (
      <div className="mx-auto max-w-lg space-y-4 p-10">
        <ErrorBlock error={authError ?? error} />
        <Button
          variant="outlineInk"
          onClick={() => (authError ? window.location.reload() : refetch())}
        >
          Try again
        </Button>
        <Link to="/login" search={{ redirect: "/admin" }} className="ml-4 text-sm underline">
          Sign in again
        </Link>
      </div>
    );

  if (loading || isLoading || !user)
    return (
      <div className="mx-auto max-w-7xl px-5 py-20">
        <LoadingBlock label="Checking your access" />
      </div>
    );

  if (!data?.permissions.length)
    return (
      <div className="mx-auto max-w-md px-5 py-28 text-center">
        <h1 className="display-lg">Staff only</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Your account does not have Back Office access.
        </p>
        <Link to="/account" className="mt-6 inline-block underline underline-offset-4">
          Back to My CometX
        </Link>
      </div>
    );

  const canVisit = (path: string) =>
    path === "/admin" ||
    path === "/admin/" ||
    !!data.permissions.includes(staffRoutePermission(path) as never);
  const visibleNav = nav.filter((item) => canVisit(item.to));
  const section = pathname.split("/")[2];
  const writePermission = (
    {
      events: "events.write",
      contacts: "contacts.write",
      members: "members.write",
      plans: "memberships.write",
    } as Record<string, string>
  )[section];
  const readOnly = writePermission && !data.permissions.includes(writePermission as never);
  const root = pathname === "/admin" || pathname === "/admin/";
  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-ink text-ink-foreground lg:flex">
        <div className="border-b border-ink-foreground/15 px-6 py-5">
          <CometXLogo />
          <p className="eyebrow mt-1 text-ink-foreground/50">Back office</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {visibleNav.map((item) => (
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
          {data?.email}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex gap-4 overflow-x-auto border-b border-border bg-ink px-4 py-3 text-ink-foreground lg:hidden">
          {visibleNav.map((item) => (
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
        {!canVisit(pathname) ? (
          <div className="p-10">
            <h1 className="text-2xl font-bold">Access restricted</h1>
            <p className="mt-3">Your role does not allow this section.</p>
          </div>
        ) : root && !data.isAdmin ? (
          <div className="space-y-4 p-10">
            <h1 className="text-2xl font-bold">Your Back Office</h1>
            <p>Select a section available to your role.</p>
            {visibleNav
              .filter((item) => item.to !== "/admin")
              .map((item) => (
                <Link key={item.to} to={item.to} className="block underline">
                  {item.label}
                </Link>
              ))}
          </div>
        ) : readOnly ? (
          <StaffReadOnly pathname={pathname} />
        ) : (
          <Outlet />
        )}
      </div>
    </div>
  );
}
