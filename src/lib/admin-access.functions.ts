import { createServerFn } from "@tanstack/react-start";
import { permissionsForRoles } from "./staff-permissions";

// Opening the Back Office must not wait for membership, benefits or profile queries.
// Every admin data handler still checks authorization independently.
export const getAdminAccess = createServerFn({ method: "GET" }).handler(async () => {
  const startedAt = performance.now();
  const { requireUser, getStaffRoles } = await import("./auth.server");
  const user = await requireUser();
  const authenticatedAt = performance.now();
  const roles = await getStaffRoles(user.userId);
  const rolesLoadedAt = performance.now();
  if (rolesLoadedAt - startedAt > 1000) {
    console.info("[admin latency] access", {
      authMs: Math.round(authenticatedAt - startedAt),
      rolesMs: Math.round(rolesLoadedAt - authenticatedAt),
    });
  }
  return {
    userId: user.userId,
    email: user.email,
    isAdmin: roles.includes("admin"),
    roles,
    permissions: permissionsForRoles(roles),
  };
});
