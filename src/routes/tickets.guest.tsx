import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock3, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock, Section, StatusPill } from "@/components/site/Bits";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatMoney } from "@/lib/pricing";
import { claimGuestTicketBatch, claimGuestTicketOrder, getGuestTicketBatch, getGuestTicketOrder } from "@/lib/ticket-orders.functions";
import { completePurchasedTicketCart } from "@/lib/ticket-cart";

export const Route = createFileRoute("/tickets/guest")({
  validateSearch: (search: Record<string, unknown>) => ({
    order: typeof search["order"] === "string" ? search["order"] : "",
    batch: typeof search["batch"] === "string" ? search["batch"] : "",
    token: typeof search["token"] === "string" ? search["token"] : "",
    paid: search["paid"] === "1" || search["paid"] === "true",
  }),
  component: GuestTicketsPage,
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }, { name: "referrer", content: "no-referrer" }] }),
});

function GuestTicketsPage() {
  const { order, batch, token, paid } = Route.useSearch();
  const { language } = useLanguage();
  const cs = language === "cs";
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const readOrder = useServerFn(getGuestTicketOrder);
  const readBatch = useServerFn(getGuestTicketBatch);
  const claimOrder = useServerFn(claimGuestTicketOrder);
  const claimBatch = useServerFn(claimGuestTicketBatch);
  const query = useQuery({
    queryKey: ["guest-ticket-order", batch, order, token],
    queryFn: async () => batch
      ? { batch: await readBatch({ data: { batchId: batch, token } }) }
      : { order: await readOrder({ data: { orderId: order, token } }) },
    enabled: Boolean((order || batch) && token),
    refetchInterval: (q) => q.state.data?.batch?.status === "pending" || q.state.data?.batch?.status === "processing" || q.state.data?.order?.status === "pending" || q.state.data?.order?.status === "processing" ? 4000 : false,
  });
  const claim = useMutation({
    mutationFn: () => batch ? claimBatch({ data: { batchId: batch, token } }) : claimOrder({ data: { orderId: order, token } }),
    onError: () => toast.error(cs ? "Propojení vstupenek se nezdařilo. Zkuste to prosím znovu." : "Could not link your tickets. Please try again."),
    onSuccess: async (ok) => {
      if (!ok) { toast.error(cs ? "Propojení se nezdařilo. Zkontrolujte e-mail účtu." : "Could not link this order. Check that your account uses the same email."); return; }
      toast.success(cs ? "Vstupenky jsou propojeny s účtem." : "Tickets linked to your account.");
      await queryClient.invalidateQueries({ queryKey: ["account"] });
      await navigate({ to: "/account/events" });
    },
  });
  const batchData = query.data?.batch;
  const ticketOrders = batchData?.orders ?? (query.data?.order ? [query.data.order] : []);
  const orderData = ticketOrders[0];
  const paidAndIssued = paid && ticketOrders.length > 0 && ticketOrders.every((item) => item.status === "confirmed" || item.status === "free");

  useEffect(() => {
    if (!paidAndIssued) return;
    const purchased = ticketOrders.flatMap((item) => item.ticket_order_items?.flatMap((line) => line.events?.[0]?.slug
      ? [{ eventSlug: line.events[0].slug, ticketId: line.ticket_type_id, quantity: Number(line.quantity) }] : []) ?? []);
    completePurchasedTicketCart(batch || order, purchased);
  }, [paidAndIssued, batchData, query.data?.order]);

  return <Section>
    <div className="mx-auto max-w-3xl rounded-[2rem] bg-card p-7 shadow-sm sm:p-10">
      {query.isLoading ? <LoadingBlock label={cs ? "Načítáme vstupenky" : "Loading your tickets"} />
        : query.error ? <ErrorBlock error={query.error} />
          : !orderData ? <div><h1 className="display-md">{cs ? "Odkaz není platný" : "This ticket link is not valid"}</h1><p className="mt-3 text-muted-foreground">{cs ? "Zkontrolujte odkaz z potvrzovacího e-mailu." : "Please use the secure link from your ticket email."}</p></div>
            : <>
              <StatusPill tone={paidAndIssued ? "success" : "muted"}>
                {paidAndIssued ? (cs ? "Vstupenky potvrzeny" : "Tickets confirmed") : (batchData?.status ?? orderData.status)}
              </StatusPill>
              <h1 className="display-md mt-5">{(orderData.ticket_order_items?.length ?? 0) > 1 || ticketOrders.length > 1 ? (cs ? "Vaše vstupenky" : "Your tickets") : orderData.ticket_order_items?.[0]?.events?.[0]?.title ?? (cs ? "Vaše vstupenky" : "Your tickets")}</h1>
              <p className="mt-2 text-muted-foreground">{orderData.buyer_name} · {orderData.buyer_email}</p>
              {ticketOrders.map((current) => <p key={current.id} className="mt-2 break-all text-xs text-muted-foreground">{cs ? "Objednávka" : "Order"} {current.id}</p>)}
              <div className="mt-5 rounded-2xl bg-accent/10 p-4 text-sm">
                <p>{cs ? "Uložte si tento soukromý odkaz pro přístup ke vstupenkám. Nesdílejte ho veřejně." : "Save this private link to access your tickets again. Do not share it publicly."}</p>
                <Button className="mt-3" variant="outline" onClick={async () => {
                  try { await navigator.clipboard.writeText(window.location.href); toast.success(cs ? "Odkaz zkopírován" : "Ticket link copied"); }
                  catch { toast.error(cs ? "Zkopírujte prosím adresu z prohlížeče." : "Please copy the address from your browser."); }
                }}>{cs ? "Kopírovat odkaz na vstupenky" : "Copy ticket link"}</Button>
              </div>
              <div className="mt-6 space-y-3">{ticketOrders.flatMap((current) => current.ticket_order_items?.map((item) => <div key={item.id} className="grid gap-3 rounded-3xl bg-background/60 p-5 text-sm sm:grid-cols-2">
                <p>{cs ? "Akce" : "Event"}: <strong>{item.events?.[0]?.title ?? "—"}</strong></p>
                <p>{cs ? "Datum" : "Date"}: <strong>{item.events?.[0]?.start_date ? new Date(item.events[0].start_date).toLocaleString(cs ? "cs-CZ" : "en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Zurich" }) : "—"}</strong></p>
                <p>{cs ? "Místo" : "Venue"}: <strong>{item.events?.[0]?.venue ?? "—"}</strong></p>
                <p>{item.quantity} × {item.ticket_name}: <strong>{formatMoney(Number(item.unit_amount_minor) * Number(item.quantity) / 100, item.currency)}</strong></p>
              </div>) ?? [])}</div>
              <p className="mt-4 text-right font-semibold">{cs ? "Celkem" : "Total"}: {formatMoney(Number(batchData?.amount_minor ?? orderData.amount_minor) / 100, orderData.currency)}</p>
              {(orderData.status === "pending" || orderData.status === "processing") && <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><Clock3 className="size-4" />{cs ? "Čekáme na potvrzení platby. Tato stránka se automaticky aktualizuje." : "Waiting for payment confirmation. This page will update automatically."}</p>}
              {(batchData?.status ?? orderData.status) === "failed" || (batchData?.status ?? orderData.status) === "expired" ? <p className="mt-5 rounded-2xl bg-destructive/10 p-4 text-sm">{cs ? "Platba nebyla dokončena, žádné vstupenky nebyly vydány. Zkuste nákup znovu." : "Payment was not completed, so no tickets were issued. Please try again."}</p> : null}
              {(batchData?.status ?? orderData.status) === "manual_review" && <p className="mt-5 rounded-2xl bg-accent/20 p-4 text-sm">{cs ? "Platba dorazila, ale objednávka vyžaduje ruční kontrolu týmem CometX. Kontaktujte nás prosím." : "Your payment arrived, but this order needs a manual review by CometX. Please contact us."}</p>}
              {paidAndIssued ? <div className="mt-7 space-y-3">
                {ticketOrders.flatMap((current) => current.ticket_order_items?.flatMap((item) => (item.ticket_attendees ?? []).map((ticket) => ({ ticket, ticketName: item.ticket_name, eventName: item.events?.[0]?.title }))) ?? []).map(({ ticket, ticketName, eventName }) => <div key={ticket.id} className="flex items-center justify-between gap-3 rounded-2xl bg-accent/10 p-4">
                  <span className="flex items-center gap-3"><Ticket className="size-5 text-accent" /><span><strong>{ticket.attendee_name}</strong><span className="block text-sm text-muted-foreground">{ticketName} · {eventName}</span></span></span>
                  <code className="rounded-lg bg-background px-2 py-1 text-xs">{ticket.ticket_code}</code>
                </div>)}
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="size-4 text-accent" />{cs ? "Ukažte kód při příchodu." : "Show your ticket code at the entrance."}</p>
              </div> : null}
              {user && paidAndIssued && <Button className="mt-7 w-full" variant="signal" disabled={claim.isPending} onClick={() => claim.mutate()}>{claim.isPending ? (cs ? "Propojujeme…" : "Linking…") : (cs ? "Přidat vstupenky do Můj CometX" : "Add tickets to My CometX")}</Button>}
              {!user && <p className="mt-7 text-sm text-muted-foreground">{cs ? "Vytvořte si účet nebo se přihlaste stejným e-mailem a potom vstupenky propojte s Můj CometX." : "Create an account or log in with this email later, then link these tickets to My CometX."} <Link className="underline underline-offset-2" to="/register" search={{ redirect: batch ? `/tickets/guest?batch=${encodeURIComponent(batch)}&token=${encodeURIComponent(token)}` : `/tickets/guest?order=${encodeURIComponent(order)}&token=${encodeURIComponent(token)}` }}>{cs ? "Vytvořit účet" : "Create account"}</Link> · <Link className="underline underline-offset-2" to="/login" search={{ redirect: batch ? `/tickets/guest?batch=${encodeURIComponent(batch)}&token=${encodeURIComponent(token)}` : `/tickets/guest?order=${encodeURIComponent(order)}&token=${encodeURIComponent(token)}` }}>{cs ? "Přihlásit se" : "Log in"}</Link></p>}
              <Link className="mt-6 inline-block text-sm underline underline-offset-2" to="/events">{cs ? "Prohlédnout další akce" : "Browse more events"}</Link>
            </>}
    </div>
  </Section>;
}
