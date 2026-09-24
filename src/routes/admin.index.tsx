import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminDashboard } from "@/lib/admin.functions";
import { ErrorBlock, LoadingBlock } from "@/components/site/Bits";
import { AdminPage } from "@/components/admin/AdminBits";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const fetchDashboard = useServerFn(getAdminDashboard);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => fetchDashboard(),
  });

  return (
    <AdminPage
      title="Dashboard"
      description="A quick read on the state of the community."
      action={
        <Button asChild variant="ink">
          <Link to="/admin/events/new">New event</Link>
        </Button>
      }
    >
      {isLoading && <LoadingBlock label="Loading numbers" />}
      {error && <ErrorBlock error={error} />}
      {data && (
        <div className="grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Events", data.events, "/admin/events"],
            ["Registrations", data.registrations, "/admin/registrations"],
            ["Active members", data.activeMembers, "/admin/members"],
            ["Articles", data.articles, "/admin/articles"],
            ["Speakers", data.speakers, "/admin/speakers"],
            ["Partners", data.partners, "/admin/partners"],
          ].map(([label, value, to]) => (
            <Link
              key={label as string}
              to={to as string}
              className="bg-card p-6 transition-colors hover:bg-paper"
            >
              <p className="eyebrow text-muted-foreground">{label as string}</p>
              <p className="mt-3 font-display text-4xl font-extrabold">{value as number}</p>
            </Link>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
