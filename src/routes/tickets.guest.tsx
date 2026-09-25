import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock3, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock, Section, StatusPill } from "@/components/site/Bits";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatMoney } from "@/lib/pricing";
import { claimGuestTicketOrder, getGuestTicketOrder } from "@/lib/ticket-orders.functions";

export const Route = createFileRoute("/tickets/guest")({
  validateSearch: (search: Record<string, unknown>) => ({
    order: typeof search["order"] === "string" ? search["order"] : "",
    token: typeof search["token"] === "string" ? search["token"] : "",
    paid: search["paid"] === "1" || search["paid"] === "true",
  }),
  component: GuestTicketsPage,
});

function GuestTicketsPage() {
  const { order, token } = Route.useSearch();
  const { language } = useLanguage();
  const cs = language === "cs";
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const readOrder = useServerFn(getGuestTicketOrder);
  const claimOrder = useServerFn(claimGuestTicketOrder);
  const query = useQuery({
    queryKey: ["guest-ticket-order", order, token],
    queryFn: () => readOrder({ data: { orderId: order, token } }),
    enabled: Boolean(order && token),
    refetchInterval: (q) => q.state.data?.status === "pending" || q.state.data?.status === "processing" ? 4000 : false,
  });
  const claim = useMutation({
    mutationFn: () => claimOrder({ data: { orderId: order, token } }),
    onSuccess: async (ok) => {
      if (!ok) { toast.error(cs ? "Propojení se nezdařilo. Zkontrolujte e-mail účtu." : "Could not link this order. Check that your account uses the same email."); return; }
      toast.success(cs ? "Vstupenky jsou propojeny s účtem." : "Tickets linked to your account.");
      await queryClient.invalidateQueries({ queryKey: ["account"] });
      await navigate({ to: "/account/events" });
    },
  });
  const orderData = query.data;

  return <Section>
    <div className="mx-auto max-w-3xl rounded-[2rem] bg-card p-7 shadow-sm sm:p-10">
      {query.isLoading ? <LoadingBlock label={cs ? "Načítáme vstupenky" : "Loading your tickets"} />
        : query.error ? <ErrorBlock error={query.error} />
          : !orderData ? <div><h1 className="display-md">{cs ? "Odkaz není platný" : "This ticket link is not valid"}</h1><p className="mt-3 text-muted-foreground">{cs ? "Zkontrolujte odkaz z potvrzovacího e-mailu." : "Please use the secure link from your ticket email."}</p></div>
            : <>
              <StatusPill tone={orderData.status === "confirmed" || orderData.status === "free" ? "success" : "muted"}>
                {orderData.status === "confirmed" || orderData.status === "free" ? (cs ? "Vstupenky potvrzeny" : "Tickets confirmed") : orderData.status}
              </StatusPill>
              <h1 className="display-md mt-5">{orderData.events?.[0]?.title ?? (cs ? "Vaše vstupenky" : "Your tickets")}</h1>
              <p className="mt-2 text-muted-foreground">{orderData.buyer_name} · {orderData.buyer_email}</p>
              <div className="mt-6 grid gap-3 rounded-3xl bg-background/60 p-5 text-sm sm:grid-cols-2">
                <p>{cs ? "Datum" : "Date"}: <strong>{orderData.events?.[0]?.start_date ? new Date(orderData.events[0].start_date).toLocaleString(cs ? "cs-CZ" : "en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Zurich" }) : "—"}</strong></p>
                <p>{cs ? "Místo" : "Venue"}: <strong>{orderData.events?.[0]?.venue ?? "—"}</strong></p>
                <p>{cs ? "Celkem" : "Total"}: <strong>{Number(orderData.amount_minor) === 0 ? (cs ? "Zdarma" : "Free") : formatMoney(Number(orderData.amount_minor) / 100, orderData.currency)}</strong></p>
              </div>
              {(orderData.status === "pending" || orderData.status === "processing") && <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><Clock3 className="size-4" />{cs ? "Čekáme na potvrzení platby. Tato stránka se automaticky aktualizuje." : "Waiting for payment confirmation. This page will update automatically."}</p>}
              {orderData.status === "failed" || orderData.status === "expired" || orderData.status === "cancelled" ? <p className="mt-5 rounded-2xl bg-destructive/10 p-4 text-sm">{cs ? "Platba nebyla dokončena, žádné vstupenky nebyly vydány. Můžete se vrátit na akci a zkusit nákup znovu." : "Payment was not completed, so no tickets were issued. Return to the event page to try again."}</p> : null}
              {orderData.status === "manual_review" && <p className="mt-5 rounded-2xl bg-accent/20 p-4 text-sm">{cs ? "Platba dorazila, ale objednávka vyžaduje ruční kontrolu týmem CometX. Kontaktujte nás prosím s číslem objednávky." : "Your payment arrived, but this order needs a manual review by CometX. Please contact us with your order ID."}</p>}
              {orderData.status === "confirmed" || orderData.status === "free" ? <div className="mt-7 space-y-3">
                {orderData.ticket_order_items?.flatMap((item) => item.ticket_attendees ?? []).map((ticket) => <div key={ticket.id} className="flex items-center justify-between gap-3 rounded-2xl bg-accent/10 p-4">
                  <span className="flex items-center gap-3"><Ticket className="size-5 text-accent" /><span><strong>{ticket.attendee_name}</strong><span className="block text-sm text-muted-foreground">{orderData.ticket_order_items?.find((item) => item.ticket_attendees?.some((t) => t.id === ticket.id))?.ticket_name}</span></span></span>
                  <code className="rounded-lg bg-background px-2 py-1 text-xs">{ticket.ticket_code}</code>
                </div>)}
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="size-4 text-accent" />{cs ? "Ukažte kód při příchodu." : "Show your ticket code at the entrance."}</p>
              </div> : null}
              {user && (orderData.status === "confirmed" || orderData.status === "free") && <Button className="mt-7 w-full" variant="signal" disabled={claim.isPending} onClick={() => claim.mutate()}>{claim.isPending ? (cs ? "Propojujeme…" : "Linking…") : (cs ? "Přidat vstupenky do Můj CometX" : "Add tickets to My CometX")}</Button>}
              {!user && <p className="mt-7 text-sm text-muted-foreground">{cs ? "Vytvořte si účet nebo se přihlaste stejným e-mailem a potom vstupenky propojte s Můj CometX." : "Create an account or log in with this email later, then link these tickets to My CometX."} <Link className="underline underline-offset-2" to="/register" search={{ redirect: `/tickets/guest?order=${encodeURIComponent(order)}&token=${encodeURIComponent(token)}` }}>{cs ? "Vytvořit účet" : "Create account"}</Link> · <Link className="underline underline-offset-2" to="/login" search={{ redirect: `/tickets/guest?order=${encodeURIComponent(order)}&token=${encodeURIComponent(token)}` }}>{cs ? "Přihlásit se" : "Log in"}</Link></p>}
              <Link className="mt-6 inline-block text-sm underline underline-offset-2" to="/events">{cs ? "Prohlédnout další akce" : "Browse more events"}</Link>
            </>}
    </div>
  </Section>;
}
