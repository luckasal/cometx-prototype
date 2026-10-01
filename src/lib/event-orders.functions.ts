import { createServerFn } from "@tanstack/react-start";
import { eventOrdersInput } from "./event-orders";

export const adminListEventOrders = createServerFn({ method: "GET" })
  .validator((input: unknown) => eventOrdersInput.parse(input))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./auth.server");
    await requireAdmin();
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { readEventOrders } = await import("./event-orders.server");
      return await readEventOrders(supabaseAdmin, data);
    } catch {
      // Configuration/provider details stay out of the staff UI. Failure is never an empty list.
      throw new Error(
        "Orders are currently unavailable. Please retry or contact your site administrator.",
      );
    }
  });
