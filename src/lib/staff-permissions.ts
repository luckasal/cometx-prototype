export const staffRoles = ["admin", "event_manager", "data_analyst", "marketing"] as const;
export type StaffRole = (typeof staffRoles)[number];

export const staffRoleLabels: Record<StaffRole, string> = {
  admin: "Administrator",
  event_manager: "Event manager",
  data_analyst: "Data analyst",
  marketing: "Marketing",
};

export const staffPermissions = [
  "events.read",
  "events.write",
  "attendees.read",
  "attendees.check_in",
  "orders.read",
  "reports.read",
  "contacts.read",
  "contacts.write",
  "newsletter.read",
  "newsletter.write",
  "content.read",
  "content.write",
  "partners.read",
  "partners.write",
  "members.read",
  "members.write",
  "memberships.read",
  "memberships.write",
  "payments.read",
  "payments.record_manual",
  "payments.manage_invoices",
  "payments.refund",
  "roles.manage",
  "settings.manage",
  "entitlements.read",
] as const;
export type StaffPermission = (typeof staffPermissions)[number];

const grants: Record<StaffRole, readonly StaffPermission[]> = {
  admin: staffPermissions,
  event_manager: [
    "events.read",
    "events.write",
    "attendees.read",
    "attendees.check_in",
    "orders.read",
    "entitlements.read",
  ],
  data_analyst: [
    "events.read",
    "attendees.read",
    "orders.read",
    "reports.read",
    "contacts.read",
    "members.read",
    "memberships.read",
    "payments.read",
  ],
  marketing: [
    "entitlements.read",
    "contacts.read",
    "contacts.write",
    "newsletter.read",
    "newsletter.write",
    "content.read",
    "content.write",
    "partners.read",
    "partners.write",
  ],
};

export function isStaffRole(role: string): role is StaffRole {
  return staffRoles.some((known) => known === role);
}

// Unknown roles and permissions never grant access. Multiple assigned roles
// combine their permissions; membership benefits are deliberately unrelated.
export function hasStaffPermission(roles: readonly string[], permission: string): boolean {
  if (!staffPermissions.some((known) => known === permission)) return false;
  return roles.some(
    (role) => isStaffRole(role) && grants[role].some((grant) => grant === permission),
  );
}

export function permissionsForRoles(roles: readonly string[]): StaffPermission[] {
  return staffPermissions.filter((permission) => hasStaffPermission(roles, permission));
}

export function staffRoutePermission(pathname: string): StaffPermission | null {
  const sections: Record<string, StaffPermission> = {
    events: "events.read",
    speakers: "events.write",
    workshops: "events.write",
    registrations: "attendees.read",
    orders: "orders.read",
    analytics: "reports.read",
    contacts: "contacts.read",
    newsletter: "newsletter.read",
    articles: "content.read",
    content: "content.read",
    partners: "partners.read",
    members: "members.read",
    plans: "memberships.read",
    payments: "payments.read",
    settings: "settings.manage",
  };
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "admin" || segments.length < 2) return null;
  const permission = Object.prototype.hasOwnProperty.call(sections, segments[1])
    ? sections[segments[1]]
    : null;
  // Analyst event detail is read-only, but new event and article editors require write permission.
  if (segments[1] === "events" && segments[2] === "new") return "events.write";
  if (segments[1] === "articles" && segments.length > 2) return "content.write";
  return permission;
}
