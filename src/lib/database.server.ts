import { createClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";
import type { Database } from "@/integrations/supabase/types";

/** A fresh client per request: caller JWTs must never leak across users. */
export function getReadClient() {
  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Supabase URL and public key are missing from server configuration.");
  const authorization = getRequest().headers.get("authorization");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: authorization ? { Authorization: authorization } : {} },
  });
}

/** Useful for public reads which never need access to private user data. */
export function getPublicClient() {
  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Supabase URL and public key are missing from server configuration.");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function assertDatabaseResult(result: { error: { message: string } | null }) {
  if (result.error) {
    console.error("[database]", result.error.message);
    throw new Error("We could not load the data. Please try again.");
  }
}
