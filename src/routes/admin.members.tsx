import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminDeleteMemberAccount,
  adminGrantMemberAdmin,
  adminListMembers,
  adminRevokeMemberAdmin,
} from "@/lib/admin.functions";
import { AdminPage, AdminTable } from "@/components/admin/AdminBits";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { withRequestTimeout } from "@/lib/request-timeout";
import { adminChangeStaffRole } from "@/lib/staff-roles.functions";
import { staffRoleLabels, type StaffRole } from "@/lib/staff-permissions";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from "@/components/site/Bits";

export const Route = createFileRoute("/admin/members")({
  component: AdminMembersPage,
});

function AdminMembersPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fetchMembers = useServerFn(adminListMembers);
  const grantAdmin = useServerFn(adminGrantMemberAdmin);
  const revokeAdmin = useServerFn(adminRevokeMemberAdmin);
  const { user } = useAuth();
  const deleteMember = useServerFn(adminDeleteMemberAccount);
  const changeStaffRole = useServerFn(adminChangeStaffRole);
  const cache = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "members"],
    queryFn: () =>
      withRequestTimeout(fetchMembers(), 15000, "Loading members took too long. Please try again."),
    retry: false,
  });
  type MemberSummary = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    company: string | null;
    country: string | null;
    created_at: string;
    planName: string | null;
    membershipStatus: string | null;
    isAdmin: boolean;
    staffRoles: StaffRole[];
  };
  const members = (data ?? []) as MemberSummary[];
  const selected = members.find((member) => member.id === selectedId) ?? null;
  const grant = useMutation({
    mutationFn: (id: string) => grantAdmin({ data: { id } }),
    onSuccess: () => {
      toast.success("Administrator access granted");
      cache.invalidateQueries({ queryKey: ["admin", "members"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteMember({ data: { id } }),
    onSuccess: () => {
      toast.success("Member account deleted");
      setSelectedId(null);
      cache.invalidateQueries({ queryKey: ["admin", "members"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => revokeAdmin({ data: { id } }),
    onSuccess: () => {
      toast.success("Administrator access removed");
      cache.invalidateQueries({ queryKey: ["admin", "members"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const staffChange = useMutation({
    mutationFn: (change: {
      id: string;
      role: "event_manager" | "data_analyst" | "marketing";
      assigned: boolean;
    }) => changeStaffRole({ data: change }),
    onSuccess: () => {
      toast.success("Staff role saved");
      cache.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AdminPage title="Members" description="Accounts, membership status, and administrator access.">
      {isLoading && <LoadingBlock label="Loading members" />}
      {error && (
        <div className="mb-6 space-y-3">
          <ErrorBlock error={error} />
          <Button variant="outlineInk" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      )}
      {data && members.length === 0 && <EmptyBlock title="No accounts yet" />}
      {data && members.length > 0 && (
        <AdminTable head={["Name", "Email", "Company", "Membership", "Role", "Joined", "Actions"]}>
          {members.map((member) => (
            <tr key={member.id} className="[&>td]:px-4 [&>td]:py-3">
              <td className="font-medium">
                <button
                  type="button"
                  className="text-left underline decoration-border underline-offset-4 hover:decoration-foreground"
                  aria-expanded={selectedId === member.id}
                  onClick={() => setSelectedId(selectedId === member.id ? null : member.id)}
                >
                  {[member.first_name, member.last_name].filter(Boolean).join(" ") ||
                    "Unnamed member"}
                </button>
              </td>
              <td className="text-muted-foreground">{member.email ?? "—"}</td>
              <td className="text-muted-foreground">{member.company ?? "—"}</td>
              <td>
                {member.planName ? (
                  <StatusPill tone="signal">{member.planName}</StatusPill>
                ) : (
                  <span className="text-xs text-muted-foreground">No membership</span>
                )}
              </td>
              <td>
                {member.isAdmin ? (
                  <StatusPill tone="signal">Admin</StatusPill>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {member.staffRoles?.length
                      ? member.staffRoles.map((role) => staffRoleLabels[role]).join(" · ")
                      : "Member"}
                  </span>
                )}
              </td>
              <td className="text-muted-foreground">
                {new Date(member.created_at).toLocaleDateString("en-GB")}
              </td>
              <td>
                <Button
                  type="button"
                  size="sm"
                  variant="outlineInk"
                  onClick={() => setSelectedId(selectedId === member.id ? null : member.id)}
                >
                  View details
                </Button>
              </td>
            </tr>
          ))}
        </AdminTable>
      )}

      {selected && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setSelectedId(null);
          }}
        >
          <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl bg-card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <DialogTitle className="font-display text-xl font-bold">Member detail</DialogTitle>
                <DialogDescription className="mt-1 text-sm text-muted-foreground">
                  {[selected.first_name, selected.last_name].filter(Boolean).join(" ") ||
                    "Unnamed member"}
                </DialogDescription>
                <p className="text-sm text-muted-foreground">
                  {selected.email ?? "No email on profile"}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outlineInk"
                onClick={() => setSelectedId(null)}
              >
                Close detail
              </Button>
            </div>

            <dl className="grid gap-4 rounded-xl border border-border/60 p-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Company</dt>
                <dd className="mt-1">{selected.company ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  Membership
                </dt>
                <dd className="mt-1">{selected.planName ?? "No active membership"}</dd>
              </div>
            </dl>

            <section
              className="rounded-xl border border-border/60 p-4"
              aria-labelledby="member-role-title"
            >
              <h3 id="member-role-title" className="font-medium">
                Account role
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {selected.isAdmin
                  ? "Administrator — full Back Office access"
                  : "Member — no Back Office access"}
              </p>
              {!selected.isAdmin && (
                <Button
                  type="button"
                  variant="ink"
                  className="mt-3"
                  disabled={grant.isPending || revoke.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Grant full Back Office administrator access to ${selected.email ?? "this member"}?`,
                      )
                    )
                      grant.mutate(selected.id);
                  }}
                >
                  {grant.isPending ? "Granting access…" : "Assign admin role"}
                </Button>
              )}
              {selected.isAdmin && (
                <>
                  <Button
                    type="button"
                    variant="outlineInk"
                    className="mt-3"
                    disabled={grant.isPending || revoke.isPending || selected.id === user?.id}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Remove Back Office administrator access from ${selected.email ?? "this member"}? Their account, membership and purchase history will remain unchanged.`,
                        )
                      )
                        revoke.mutate(selected.id);
                    }}
                  >
                    {revoke.isPending ? "Removing access…" : "Unassign admin role"}
                  </Button>
                  {selected.id === user?.id && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Another administrator must remove your admin role to prevent locking you out.
                    </p>
                  )}
                </>
              )}
              <div className="mt-5 space-y-3 border-t border-border pt-4">
                <p className="text-sm text-muted-foreground">
                  Additional staff roles can be combined. Administrator already includes all
                  permissions.
                </p>
                {(["event_manager", "data_analyst", "marketing"] as const).map((role) => {
                  const assigned = selected.staffRoles?.includes(role) ?? false;
                  return (
                    <div key={role} className="flex flex-wrap items-center justify-between gap-3">
                      <span>{staffRoleLabels[role]}</span>
                      <Button
                        variant="outlineInk"
                        size="sm"
                        disabled={
                          staffChange.isPending ||
                          grant.isPending ||
                          revoke.isPending ||
                          selected.id === user?.id
                        }
                        onClick={() => {
                          if (
                            window.confirm(
                              `${assigned ? "Unassign" : "Assign"} ${staffRoleLabels[role]} for ${selected.email ?? "this member"}? This changes Back Office access only; memberships and orders remain unchanged.`,
                            )
                          )
                            staffChange.mutate({ id: selected.id, role, assigned: !assigned });
                        }}
                      >
                        {assigned ? "Unassign" : "Assign"} {staffRoleLabels[role]}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </section>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="destructive"
                disabled={
                  remove.isPending || grant.isPending || revoke.isPending || selected.isAdmin
                }
                title={
                  selected.isAdmin
                    ? "Remove administrator access before deleting this account."
                    : undefined
                }
                onClick={() => {
                  if (
                    window.confirm(
                      `Permanently delete the account for ${selected.email ?? "this member"}? This cannot be undone. It will be blocked if any membership, ticket, order, registration, or payment history exists.`,
                    )
                  )
                    remove.mutate(selected.id);
                }}
              >
                {remove.isPending ? "Deleting account…" : "Delete member account"}
              </Button>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Admin access grants the full Back Office. Account deletion is permanent and is
              permitted only when no membership, ticket, order, registration, or payment history is
              linked. Linked contact records are retained as contacts.
            </p>
          </DialogContent>
        </Dialog>
      )}
    </AdminPage>
  );
}
