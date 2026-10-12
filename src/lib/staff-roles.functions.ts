import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const roleChange = z.object({
  id: z.string().uuid(),
  role: z.enum(["event_manager", "data_analyst", "marketing"]),
  assigned: z.boolean(),
});

export const adminChangeStaffRole = createServerFn({ method: "POST" })
  .validator((input: unknown) => roleChange.parse(input))
  .handler(async ({ data }) => {
    const actor = await (await import("./auth.server")).requireAdmin();
    if (actor.userId === data.id)
      throw new Error("Another administrator must change your own staff roles.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as SupabaseClient;
    const profile = await db.from("profiles").select("id").eq("id", data.id).maybeSingle();
    if (profile.error || !profile.data) throw new Error("This account could not be found.");
    const result = data.assigned
      ? await db.from("user_roles").insert({ user_id: data.id, role: data.role })
      : await db.from("user_roles").delete().eq("user_id", data.id).eq("role", data.role);
    if (result.error && !(data.assigned && result.error.code === "23505")) {
      throw new Error(
        "The staff role could not be saved. Check that staff-role database setup is complete, then retry.",
      );
    }
    return { ok: true };
  });
