import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorBlock, LoadingBlock, PageHero, Section } from "@/components/site/Bits";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { getEventDetail, startTicketCheckout } from "@/lib/events.functions";
import { getAccountOverview } from "@/lib/membership.functions";
import { formatMoney } from "@/lib/pricing";
import { readTicketCart, writeTicketCart, type TicketCartLine } from "@/lib/ticket-cart";
import { trackEvent } from "@/lib/analytics";

export const Route = createFileRoute("/checkout")({ beforeLoad: () => { throw redirect({ to: "/cart" }); }, component: CheckoutPage });

function CheckoutPage() {
  const { language } = useLanguage();
  const cs = language === "cs";
  const { user } = useAuth();
  const fetchEvent = useServerFn(getEventDetail);
  const fetchAccount = useServerFn(getAccountOverview);
  const startCheckout = useServerFn(startTicketCheckout);
  const [lines, setLines] = useState<TicketCartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");

  useEffect(() => {
    setLines(readTicketCart());
    setReady(true);
  }, []);

  const groups = useMemo(() => [...new Set(lines.map((line) => line.eventSlug))], [lines]);
  useEffect(() => {
    if (groups.length && !groups.includes(selectedSlug)) setSelectedSlug(groups[0]!);
  }, [groups, selectedSlug]);

  const eventQueries = useQueries({
    queries: groups.map((slug) => ({
      queryKey: ["cart-event", slug, user?.id ?? "guest"],
      queryFn: () => fetchEvent({ data: { slug, preview: false } }),
      enabled: ready,
    })),
  });
  const accountQuery = useQuery({
    queryKey: ["account", "checkout-prefill", user?.id],
    queryFn: () => fetchAccount(),
    enabled: !!user,
  });

  useEffect(() => {
    const profile = accountQuery.data?.profile;
    if (!profile) return;
    setBuyerName([profile.firstName, profile.lastName].filter(Boolean).join(" "));
    setBuyerEmail(profile.email ?? user?.email ?? "");
  }, [accountQuery.data, user?.email]);

  const selectedIndex = groups.indexOf(selectedSlug);
  const selectedLines = lines.filter((line) => line.eventSlug === selectedSlug);
  const detail = selectedIndex >= 0 ? eventQueries[selectedIndex]?.data : undefined;
  const selectedTickets = selectedLines.map((line) => ({ line, ticket: detail?.tickets.find((ticket) => ticket.id === line.ticketId) }));
  const currencies = new Set(selectedTickets.flatMap(({ ticket }) => ticket ? [ticket.price.currency] : []));
  const groupReady = !!detail && detail.registrationOpen && currencies.size <= 1 && selectedTickets.length > 0 && selectedTickets.every(({ ticket }) =>
    ticket && ticket.price.eligible && !ticket.soldOut &&
    (!ticket.saleStart || Date.parse(ticket.saleStart) <= Date.now()) &&
    (!ticket.saleEnd || Date.parse(ticket.saleEnd) > Date.now()),
  );
  const total = selectedTickets.reduce((sum, { line, ticket }) => sum + (ticket?.price.finalPrice ?? 0) * line.quantity, 0);
  const currency = selectedTickets.find(({ ticket }) => ticket)?.ticket?.price.currency;

  const checkoutMutation = useMutation({
    mutationFn: () => startCheckout({
      data: {
        lines: selectedLines.map((line) => ({ ticketTypeId: line.ticketId, quantity: line.quantity })),
        ...(!user ? { buyerName, buyerEmail } : {}),
      },
    }),
    onSuccess: (result) => {
      trackEvent(result.url ? "ticket_checkout_started" : "free_ticket_issued", { event_slug: selectedSlug });
      if (result.url) { window.location.assign(result.url); return; }
      const remaining = readTicketCart().filter((line) => line.eventSlug !== selectedSlug);
      writeTicketCart(remaining);
      if (result.accessUrl) { window.location.assign(result.accessUrl); return; }
      toast.success(cs ? "Vstupenka je potvrzena. Najdete ji v Můj CometX." : "Your ticket is confirmed. See it in My CometX.");
      window.location.assign(user ? "/account/events" : "/events");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    checkoutMutation.mutate();
  }

  if (!ready) return <Section><LoadingBlock label={cs ? "Načítáme objednávku" : "Loading checkout"} /></Section>;

  return <>
    <PageHero eyebrow={cs ? "Objednávka" : "Checkout"} title={cs ? "Dokončení objednávky" : "Complete your order"}
      lead={cs ? "Zadejte kontaktní údaje a zkontrolujte vstupenky." : "Add your contact details and review your tickets."} />
    <Section>
      {lines.length === 0 ? <div className="rounded-3xl bg-card p-8 text-center sm:p-12">
        <h2 className="font-display text-2xl font-bold">{cs ? "Váš košík je prázdný" : "Your cart is empty"}</h2>
        <Button asChild variant="signal" className="mt-6"><Link to="/events">{cs ? "Prohlédnout akce" : "Browse events"}<ArrowRight className="size-4" /></Link></Button>
      </div> : <form className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-10" onSubmit={submit}>
        <div className="rounded-3xl bg-card/60 p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold">{cs ? "Vaše vstupenky" : "Your tickets"}</h2>
            {groups.length > 1 && <label className="text-sm text-muted-foreground">
              <span className="sr-only">{cs ? "Akce k zaplacení" : "Event to pay for"}</span>
              <select className="min-h-10 max-w-64 rounded-full bg-background px-4 text-foreground" value={selectedSlug} onChange={(event) => setSelectedSlug(event.target.value)}>
                {groups.map((slug, index) => <option key={slug} value={slug}>{eventQueries[index]?.data?.event.title ?? slug}</option>)}
              </select>
            </label>}
          </div>
          {selectedIndex >= 0 && eventQueries[selectedIndex]?.isLoading ? <LoadingBlock label={cs ? "Načítáme vstupenky" : "Loading tickets"} />
            : selectedIndex >= 0 && eventQueries[selectedIndex]?.error ? <ErrorBlock error={eventQueries[selectedIndex]!.error} />
              : <div className="mt-5 divide-y divide-foreground/10">
                {selectedTickets.map(({ line, ticket }) => <div key={line.ticketId} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                  {detail?.event.heroImageUrl && <img src={detail.event.heroImageUrl} alt="" className="size-16 shrink-0 rounded-xl object-cover" />}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold">{detail?.event.title ?? line.eventSlug}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{ticket?.name ?? (cs ? "Vstupenka již není dostupná" : "Ticket no longer available")} · {line.quantity}× {ticket ? formatMoney(ticket.price.finalPrice, ticket.price.currency) : "—"}</p>
                    {detail && <p className="mt-1 text-xs text-muted-foreground">{new Date(detail.event.startDate).toLocaleString(cs ? "cs-CZ" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zurich" })}{detail.event.venue ? ` · ${detail.event.venue}` : ""}</p>}
                  </div>
                  <strong className="shrink-0 tabular-nums">{ticket ? formatMoney(ticket.price.finalPrice * line.quantity, ticket.price.currency) : "—"}</strong>
                </div>)}
              </div>}
          {groups.length > 1 && <p className="mt-5 text-sm text-muted-foreground">{cs ? "Objednávky se zpracovávají vždy pro jednu akci. Po dokončení můžete pokračovat s další." : "Orders are processed one event at a time. You can continue with another event afterward."}</p>}
          <Button asChild variant="ghost" className="mt-5 px-0 text-muted-foreground"><Link to="/cart"><ArrowLeft className="size-4" />{cs ? "Zpět do košíku" : "Back to cart"}</Link></Button>
        </div>

        <aside className="rounded-3xl bg-card/60 p-5 lg:sticky lg:top-28">
          <p className="eyebrow text-accent-foreground/70">{cs ? "Kontaktní údaje" : "Contact details"}</p>
          {user ? <>
            <h2 className="mt-1 font-display text-xl font-bold">{cs ? "Údaje vašeho účtu" : "Your account details"}</h2>
            {accountQuery.isLoading ? <LoadingBlock label={cs ? "Načítáme váš účet" : "Loading your account"} /> : <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium">{cs ? "Jméno a příjmení" : "Full name"}<Input className="mt-2 min-h-11 rounded-2xl border-0 bg-background/60 px-4" autoComplete="name" value={buyerName || user.email || ""} readOnly /></label>
              <label className="block text-sm font-medium">Email<Input className="mt-2 min-h-11 rounded-2xl border-0 bg-background/60 px-4" type="email" autoComplete="email" value={buyerEmail || user.email || ""} readOnly /></label>
            </div>}
          </> : <>
            <p className="mt-2 text-sm text-muted-foreground">{cs ? "Máte účet?" : "Already have an account?"} <Link to="/login" className="font-medium text-accent underline underline-offset-4">{cs ? "Přihlásit se" : "Log in"}</Link></p>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium">{cs ? "Jméno a příjmení" : "Full name"}<Input className="mt-2 min-h-11 rounded-2xl border-0 bg-background/60 px-4" autoComplete="name" required maxLength={240} value={buyerName} onChange={(event) => setBuyerName(event.target.value)} /></label>
              <label className="block text-sm font-medium">Email<Input className="mt-2 min-h-11 rounded-2xl border-0 bg-background/60 px-4" type="email" autoComplete="email" required maxLength={320} value={buyerEmail} onChange={(event) => setBuyerEmail(event.target.value)} /></label>
            </div>
          </>}
          <div className="mt-7 border-t border-foreground/10 pt-5">
            <p className="text-sm text-muted-foreground">{cs ? "Celkem" : "Total"}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{currency ? formatMoney(total, currency) : "—"}</p>
            <Button type="submit" variant="signal" className="mt-5 min-h-12 w-full rounded-full" disabled={!groupReady || checkoutMutation.isPending || (user ? accountQuery.isLoading : (!buyerName.trim() || !buyerEmail.trim()))}>
              {checkoutMutation.isPending ? (cs ? "Připravujeme…" : "Preparing…") : (cs ? "Pokračovat k platbě" : "Continue to payment")}<ArrowRight className="size-4" />
            </Button>
          </div>
        </aside>
      </form>}
    </Section>
  </>;
}
