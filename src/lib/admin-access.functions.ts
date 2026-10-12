import { createServerFn } from "@tanstack/react-start";

// Opening the Back Office must not wait for membership, benefits or profile queries.
// Every admin data handler still checks authorization independently.
export const getAdminAccess = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser, isAdmin } = await import("./auth.server");
  const user = await requireUser();
  return { userId: user.userId, email: user.email, isAdmin: await isAdmin(user.userId) };
});
