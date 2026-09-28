import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowRight, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorBlock, LoadingBlock, PageHero, Section } from "@/components/site/Bits";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { getEventDetail, startTicketCheckout } from "@/lib/events.functions";
import { getAccountOverview } from "@/lib/membership.functions";
import { formatMoney } from "@/lib/pricing";
import { readTicketCart, ticketCartCount, ticketCartCountLabel, writeTicketCart, type TicketCartLine } from "@/lib/ticket-cart";
import { trackEvent } from "@/lib/analytics";

export const Route = createFileRoute("/cart")({ component: CartPage });

function CartPage() {
  const { language } = useLanguage();
  const cs = language === "cs";
  const { user } = useAuth();
  const fetchEvent = useServerFn(getEventDetail);
  const fetchAccount = useServerFn(getAccountOverview);
  const startCheckout = useServerFn(startTicketCheckout);
  const [lines, setLines] = useState<TicketCartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [checkoutSlug, setCheckoutSlug] = useState<string | null>(null);

  useEffect(() => {
    setLines(readTicketCart());
    setReady(true);
  }, []);

  const groups = useMemo(() => [...new Set(lines.map((line) => line.eventSlug))], [lines]);
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

  const groupReadiness = groups.map((slug, index) => {
    const detail = eventQueries[index]?.data;
    const eventLines = lines.filter((line) => line.eventSlug === slug);
    const tickets = eventLines.map((line) => ({
      line,
      ticket: detail?.tickets.find((item) => item.id === line.ticketId),
    }));
    const currencies = new Set(tickets.flatMap(({ ticket }) => ticket ? [ticket.price.currency] : []));
    const ready = !!detail && detail.registrationOpen && currencies.size <= 1 && tickets.length > 0 && tickets.every(({ ticket }) =>
      ticket && ticket.price.eligible && !ticket.soldOut &&
      (!ticket.saleStart || Date.parse(ticket.saleStart) <= Date.now()) &&
      (!ticket.saleEnd || Date.parse(ticket.saleEnd) > Date.now()),
    );
    return { ready, free: ready && tickets.every(({ ticket }) => ticket!.price.finalPrice === 0) };
  });

  useEffect(() => {
    const profile = accountQuery.data?.profile;
    if (!profile) return;
    setBuyerName([profile.firstName, profile.lastName].filter(Boolean).join(" "));
    setBuyerEmail(profile.email ?? user?.email ?? "");
  }, [accountQuery.data, user?.email]);

  const checkoutMutation = useMutation({
    mutationFn: ({ slug, tickets }: { slug: string; tickets: { ticketTypeId: string; quantity: number }[] }) =>
      startCheckout({ data: { lines: tickets, ...(!user ? { buyerName, buyerEmail } : {}) } }),
    onSuccess: (result, variables) => {
      trackEvent(result.url ? "ticket_checkout_started" : "free_ticket_issued", { event_slug: variables.slug });
      if (result.url) { window.location.assign(result.url); return; }
      const remaining = readTicketCart().filter((line) => line.eventSlug !== variables.slug);
      saveCart(remaining);
      if (result.accessUrl) { window.location.assign(result.accessUrl); return; }
      toast.success(cs ? "Vstupenka je potvrzena. Najdete ji v Můj CometX." : "Your ticket is confirmed. See it in My CometX.");
      window.location.assign(user ? "/account/events" : "/events");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function saveCart(next: TicketCartLine[]) {
    setLines(next);
    writeTicketCart(next);
  }

  function changeQuantity(line: TicketCartLine, quantity: number) {
    const eventTotal = lines.filter((item) => item.eventSlug === line.eventSlug && item.ticketId !== line.ticketId)
      .reduce((sum, item) => sum + item.quantity, 0);
    const nextQuantity = Math.max(0, Math.min(quantity, 10 - eventTotal));
    saveCart(nextQuantity === 0
      ? lines.filter((item) => !(item.eventSlug === line.eventSlug && item.ticketId === line.ticketId))
      : lines.map((item) => item.eventSlug === line.eventSlug && item.ticketId === line.ticketId ? { ...item, quantity: nextQuantity } : item));
  }

  function submitCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const slug = submitter instanceof HTMLButtonElement ? submitter.getAttribute("data-event-slug") : null;
    if (!slug) return;
    const tickets = lines.filter((line) => line.eventSlug === slug).map((line) => ({ ticketTypeId: line.ticketId, quantity: line.quantity }));
    setCheckoutSlug(slug);
    checkoutMutation.mutate({ slug, tickets });
  }

  if (!ready) return <Section><LoadingBlock label={cs ? "Načítáme košík" : "Loading your cart"} /></Section>;

  return <>
    <PageHero eyebrow={cs ? "Vstupenky" : "Tickets"} title={cs ? "Váš košík" : "Your cart"}
      lead={cs ? "Zkontrolujte vstupenky a údaje před bezpečnou platbou." : "Review your tickets and details before continuing to secure payment."} />
    <Section>
      {lines.length === 0 ? <div className="rounded-3xl bg-card p-8 text-center sm:p-12">
        <ShoppingCart className="mx-auto size-8 text-accent" />
        <h2 className="mt-4 font-display text-2xl font-bold">{cs ? "V košíku zatím nic není" : "Your cart is empty"}</h2>
        <p className="mt-2 text-muted-foreground">{cs ? "Vyberte počet vstupenek na stránce akce a přidejte je sem." : "Choose a ticket quantity on an event page and add it here."}</p>
        <Button asChild variant="signal" className="mt-6"><Link to="/events">{cs ? "Prohlédnout akce" : "Browse events"}<ArrowRight className="size-4" /></Link></Button>
      </div> : <form className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]" onSubmit={submitCheckout}>
        <div className="space-y-6">
          {eventQueries.map((query, index) => {
            const slug = groups[index]!;
            const eventLines = lines.filter((line) => line.eventSlug === slug);
            if (query.isLoading) return <div key={slug} className="rounded-3xl bg-card p-6"><LoadingBlock label={cs ? "Načítáme vstupenky" : "Loading tickets"} /></div>;
            if (query.error) return <div key={slug} className="rounded-3xl bg-card p-6"><ErrorBlock error={query.error} /></div>;
            const detail = query.data;
            if (!detail) return null;
            let subtotal = 0;
            const ticketRows = eventLines.map((line) => {
              const ticket = detail.tickets.find((item) => item.id === line.ticketId);
              if (!ticket) return { line, ticket: null, lineTotal: 0, saleOpen: false };
              const saleOpen = (!ticket.saleStart || Date.parse(ticket.saleStart) <= Date.now()) && (!ticket.saleEnd || Date.parse(ticket.saleEnd) > Date.now());
              const lineTotal = ticket.price.finalPrice * line.quantity;
              subtotal += lineTotal;
              return { line, ticket, lineTotal, saleOpen };
            });
            const currencies = new Set(ticketRows.flatMap(({ ticket }) => ticket ? [ticket.price.currency] : []));
            const sameCurrency = currencies.size <= 1;
            const purchasable = detail.registrationOpen && sameCurrency && ticketRows.every(({ ticket, saleOpen }) => ticket && ticket.price.eligible && !ticket.soldOut && saleOpen);
            return <article key={slug} className="rounded-3xl bg-card p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><p className="eyebrow text-accent">{cs ? "Akce" : "Event"}</p><h2 className="mt-2 font-display text-2xl font-bold"><Link to="/events/$slug" params={{ slug }} className="hover:underline">{detail.event.title}</Link></h2>
                  <p className="mt-2 text-sm text-muted-foreground">{new Date(detail.event.startDate).toLocaleString(cs ? "cs-CZ" : "en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Zurich" })}{detail.event.venue ? ` · ${detail.event.venue}` : ""}</p>
                </div>
                <button type="button" className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-muted-foreground hover:bg-background hover:text-foreground" onClick={() => saveCart(lines.filter((line) => line.eventSlug !== slug))}><Trash2 className="size-4" />{cs ? "Odebrat akci" : "Remove event"}</button>
              </div>
              <div className="mt-6 divide-y divide-border/50">
                {ticketRows.map(({ line, ticket, lineTotal, saleOpen }) => <div key={line.ticketId} className="flex flex-wrap items-center justify-between gap-4 py-5">
                  <div className="min-w-48 flex-1"><h3 className="font-semibold">{ticket?.name ?? (cs ? "Vstupenka již není dostupná" : "Ticket no longer available")}</h3>
                    {ticket && <p className="mt-1 text-sm text-muted-foreground">{ticket.price.finalPrice !== ticket.price.basePrice ? <><span className="mr-2 line-through">{formatMoney(ticket.price.basePrice, ticket.price.currency)}</span><span>{formatMoney(ticket.price.finalPrice, ticket.price.currency)}{cs ? " s členským benefitem" : " with member benefit"}</span></> : formatMoney(ticket.price.finalPrice, ticket.price.currency)} {cs ? "za kus" : "each"}</p>}
                    {ticket && (!detail.registrationOpen || !saleOpen || ticket.soldOut || !ticket.price.eligible) && <p className="mt-1 text-sm text-destructive">{cs ? "Tento typ vstupenky už nelze koupit." : "This ticket type is no longer available."}</p>}
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-background p-1">
                    <button type="button" aria-label={cs ? "Odebrat jednu vstupenku" : "Remove one ticket"} className="grid size-9 place-items-center rounded-full hover:bg-card" onClick={() => changeQuantity(line, line.quantity - 1)}><Minus className="size-4" /></button>
                    <span className="min-w-7 text-center tabular-nums">{line.quantity}</span>
                    <button type="button" aria-label={cs ? "Přidat jednu vstupenku" : "Add one ticket"} className="grid size-9 place-items-center rounded-full hover:bg-card" disabled={!ticket || ticket.soldOut || line.quantity + eventLines.filter((item) => item.eventSlug === line.eventSlug && item.ticketId !== line.ticketId).reduce((sum, item) => sum + item.quantity, 0) >= 10} onClick={() => changeQuantity(line, line.quantity + 1)}><Plus className="size-4" /></button>
                  </div>
                  <strong className="min-w-24 text-right">{ticket ? formatMoney(lineTotal, ticket.price.currency) : "—"}</strong>
                </div>)}
              </div>
              <div className="flex justify-between border-t border-border/50 pt-5 text-lg font-bold"><span>{cs ? "Mezisoučet" : "Subtotal"}</span><span>{ticketRows[0]?.ticket && sameCurrency ? formatMoney(subtotal, ticketRows[0].ticket.price.currency) : (cs ? "Více měn" : "Multiple currencies")}</span></div>
              <p className="mt-3 text-xs text-muted-foreground">{cs ? "Cena a členský nárok budou před platbou znovu ověřeny serverem." : "Price and membership eligibility are revalidated by the server before payment."}</p>
              {!sameCurrency && <p className="mt-3 text-sm text-destructive">{cs ? "V jedné objednávce nelze kombinovat různé měny. Odeberte některý typ vstupenky." : "Ticket types in one order must use the same currency. Remove one currency type."}</p>}
              {!purchasable && <p className="mt-3 text-sm text-destructive">{cs ? "Některé vstupenky nejsou dostupné. Upravte košík nebo vyberte jinou akci." : "Some tickets are unavailable. Update your cart or choose another event."}</p>}
            </article>;
          })}
        </div>

        <aside className="rounded-3xl bg-card p-6 lg:sticky lg:top-28">
          <h2 className="font-display text-xl font-bold">{cs ? "Kontaktní údaje kupujícího" : "Buyer details"}</h2>
          {user ? <>
            <p className="mt-2 text-sm text-muted-foreground">{cs ? "Použijeme údaje vašeho účtu." : "We’ll use your account details."}</p>
            {accountQuery.isLoading ? <LoadingBlock label={cs ? "Načítáme váš účet" : "Loading your account"} /> : <div className="mt-5 space-y-3 text-sm"><p><span className="text-muted-foreground">{cs ? "Jméno" : "Name"}</span><br /><strong>{buyerName || user.email}</strong></p><p><span className="text-muted-foreground">Email</span><br /><strong>{buyerEmail || user.email}</strong></p></div>}
          </> : <>
            <p className="mt-2 text-sm text-muted-foreground">{cs ? "Vstupenky a potvrzení budou spojeny s tímto e-mailem." : "Tickets and confirmation will be linked to this email."}</p>
            <label className="mt-5 block text-sm font-medium">{cs ? "Jméno a příjmení" : "Full name"}<Input className="mt-2 rounded-xl" autoComplete="name" required maxLength={240} value={buyerName} onChange={(event) => setBuyerName(event.target.value)} /></label>
            <label className="mt-4 block text-sm font-medium">Email<Input className="mt-2 rounded-xl" type="email" autoComplete="email" required maxLength={320} value={buyerEmail} onChange={(event) => setBuyerEmail(event.target.value)} /></label>
            <p className="mt-3 text-xs text-muted-foreground">{cs ? "Nákup nevytvoří členský účet ani nepřihlásí vás k newsletteru." : "Buying a ticket does not create a membership or subscribe you to the newsletter."}</p>
          </>}
          <p className="mt-6 rounded-2xl bg-background p-4 text-sm text-muted-foreground">{cs ? "Další krok otevře zabezpečenou platební stránku. Platba proběhne až po vašem potvrzení tam." : "The next step opens secure checkout. Payment only happens if you confirm it there."}</p>
          {groups.map((slug, index) => <Button key={slug} type="submit" data-event-slug={slug} variant="signal" className="mt-4 w-full" disabled={checkoutMutation.isPending || !ready || !groupReadiness[index]?.ready || (user ? accountQuery.isLoading : false)}>
            {checkoutMutation.isPending && checkoutSlug === slug ? (cs ? "Připravujeme…" : "Preparing…") : groupReadiness[index]?.free ? (cs ? "Potvrdit bezplatné vstupenky" : "Confirm free tickets") : (cs ? "Pokračovat k bezpečné platbě" : "Continue to secure payment")}<ArrowRight className="size-4" />
          </Button>)}
          <p className="mt-4 text-center text-xs text-muted-foreground">{cs ? "Každá akce se odbavuje jako samostatná objednávka." : "Each event is checked out as a separate order."}</p>
        </aside>
      </form>}
      {lines.length > 0 && <p className="mt-6 text-sm text-muted-foreground">{cs ? `V košíku máte ${ticketCartCountLabel(ticketCartCount(lines), cs)}.` : `Your cart contains ${ticketCartCountLabel(ticketCartCount(lines), cs)}.`}</p>}
    </Section>
  </>;
}
