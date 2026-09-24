import { getRequest } from "@tanstack/react-start/server";
import { getReadClient } from "./database.server";

export type SessionUser = {
  userId: string;
  email: string | null;
};

/**
 * Reads the bearer token attached by src/start.ts functionMiddleware.
 * Returns null for guests - never throws, so public pages can call it.
 */
export async function getOptionalUser(): Promise<SessionUser | null> {
  const request = getRequest();
  const authHeader = request?.headers?.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length);
  if (!token || token.split(".").length !== 3) return null;

  const { data, error } = await getReadClient().auth.getUser(token);
  if (error || !data.user) return null;
  return { userId: data.user.id, email: data.user.email ?? null };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getOptionalUser();
  if (!user) throw new Error("You need to be signed in to do that.");
  return user;
}

export async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await getReadClient()
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!(await isAdmin(user.userId))) {
    throw new Error("Admin access required.");
  }
  return user;
}
