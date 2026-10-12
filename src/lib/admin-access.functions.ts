import { createServerFn } from "@tanstack/react-start";
import { permissionsForRoles } from "./staff-permissions";

// Opening the Back Office must not wait for membership, benefits or profile queries.
// Every admin data handler still checks authorization independently.
export const getAdminAccess = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser, getStaffRoles } = await import("./auth.server");
  const user = await requireUser();
  const roles = await getStaffRoles(user.userId);
  return {
    userId: user.userId,
    email: user.email,
    isAdmin: roles.includes("admin"),
    roles,
    permissions: permissionsForRoles(roles),
  };
});
