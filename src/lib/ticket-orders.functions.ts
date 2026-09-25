import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const guestAccessInput = z.object({ orderId: z.string().uuid(), token: z.string().min(40).max(100) });

export const getGuestTicketOrder = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => guestAccessInput.parse(data))
  .handler(async ({ data }) => {
    const { getGuestTicketOrder: read } = await import("./ticket-orders.server");
    return read(data.orderId, data.token);
  });

export const getMyPurchasedTickets = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser } = await import("./auth.server");
  const user = await requireUser();
  const { getMyPurchasedTickets: read } = await import("./ticket-orders.server");
  return read(user.userId);
});

export const claimGuestTicketOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => guestAccessInput.parse(data))
  .handler(async ({ data }) => {
    const { requireUser } = await import("./auth.server");
    const user = await requireUser();
    const { claimTicketOrder } = await import("./ticket-orders.server");
    return claimTicketOrder(data.orderId, data.token, user.userId);
  });
