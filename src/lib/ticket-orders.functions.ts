import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const attendeeInput = z.object({ firstName: z.string().trim().min(1).max(120), lastName: z.string().trim().min(1).max(120) });
const batchCheckoutInput = z.object({
  events: z.array(z.object({ eventSlug: z.string().min(1).max(200), lines: z.array(z.object({ ticketId: z.string().uuid(), quantity: z.number().int().min(1).max(10), attendees: z.array(attendeeInput).min(1).max(10) })).min(1).max(10) })).min(1).max(10),
  buyerName: z.string().trim().max(240).optional(), buyerEmail: z.string().email().max(320).optional(), termsAccepted: z.literal(true),
});

export const startTicketCheckoutBatch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => batchCheckoutInput.parse(data))
  .handler(async ({ data }) => {
    const { getOptionalUser } = await import("./auth.server");
    const user = await getOptionalUser();
    if (!user && (!data.buyerName || !data.buyerEmail)) throw new Error("Enter your contact details to continue.");
    const { startTicketCheckoutBatch: start } = await import("./ticket-orders.server");
    return start({ userId: user?.userId ?? null, events: data.events, termsAccepted: data.termsAccepted,
      ...(data.buyerName ? { buyerName: data.buyerName } : {}), ...(data.buyerEmail ? { buyerEmail: data.buyerEmail } : {}) });
  });

const guestAccessInput = z.object({ orderId: z.string().uuid(), token: z.string().min(40).max(100) });
const guestBatchAccessInput = z.object({ batchId: z.string().uuid(), token: z.string().min(40).max(100) });

export const getGuestTicketBatch = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => guestBatchAccessInput.parse(data))
  .handler(async ({ data }) => {
    const { getGuestTicketBatch: read } = await import("./ticket-orders.server");
    return read(data.batchId, data.token);
  });

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
