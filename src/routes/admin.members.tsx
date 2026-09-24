import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListMembers } from "@/lib/admin.functions";
import { AdminPage, AdminTable } from "@/components/admin/AdminBits";
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from "@/components/site/Bits";

export const Route = createFileRoute("/admin/members")({
  component: AdminMembersPage,
});

function AdminMembersPage() {
  const fetchMembers = useServerFn(adminListMembers);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "members"],
    queryFn: () => fetchMembers(),
  });

  return (
    <AdminPage title="Members" description="Everyone with an account, and their membership status.">
      {isLoading && <LoadingBlock label="Loading members" />}
      {error && <ErrorBlock error={error} />}
      {data && data.length === 0 && <EmptyBlock title="No accounts yet" />}
      {data && data.length > 0 && (
        <AdminTable head={["Name", "Email", "Company", "Membership", "Joined"]}>
          {data.map((member) => (
            <tr key={member.id} className="[&>td]:px-4 [&>td]:py-3">
              <td className="font-medium">
                {[member.first_name, member.last_name].filter(Boolean).join(" ") || "-"}
              </td>
              <td className="text-muted-foreground">{member.email}</td>
              <td className="text-muted-foreground">{member.company ?? "-"}</td>
              <td>
                {member.planName ? (
                  <StatusPill tone="signal">{member.planName}</StatusPill>
                ) : (
                  <span className="text-xs text-muted-foreground">No membership</span>
                )}
              </td>
              <td className="text-muted-foreground">
                {new Date(member.created_at).toLocaleDateString("en-GB")}
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </AdminPage>
  );
}
