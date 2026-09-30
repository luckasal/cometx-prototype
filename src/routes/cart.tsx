import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorBlock, LoadingBlock, PageHero, Section } from "@/components/site/Bits";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { getEventDetail } from "@/lib/events.functions";
import { getAccountOverview } from "@/lib/membership.functions";
import { formatMoney, formatMembershipBenefit } from "@/lib/pricing";
import { attendeeMatchesBuyer, buyerNamedAttendeeCount, clearAttendeeName, copyBuyerNameToAttendee, readTicketCart, writeTicketCart, type TicketCartLine } from "@/lib/ticket-cart";
import { trackEvent } from "@/lib/analytics";
import { startTicketCheckoutBatch } from "@/lib/ticket-orders.functions";

export const Route = createFileRoute("/cart")({ component: CartPage });

type CheckoutPolicies = { text: string; consents: { id: string; label: string; required: boolean }[] };

function requiredPoliciesAccepted(policies: CheckoutPolicies | null, accepted: Record<string, boolean>) {
  return !policies || policies.consents.every((consent) => !consent.required || accepted[consent.id] === true);
}

function EventPolicies({ policies, cs, accepted, onAccept }: {
  policies: CheckoutPolicies | null;
  cs: boolean;
  accepted: Record<string, boolean>;
  onAccept: (id: string, checked: boolean) => void;
}) {
  if (!policies) return null;
  return <section className="rounded-3xl bg-card p-5 sm:p-6">
    <h2 className="font-display text-xl font-bold"><span className="text-accent">3.</span> {cs ? "Podmínky akce" : "Event policies"}</h2>
    <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{policies.text}</p>
    {policies.consents.map((consent) => <label key={consent.id} className="mt-4 flex items-start gap-3 text-sm">
      <input type="checkbox" name={`consent-${consent.id}`} required={consent.required} checked={accepted[consent.id] === true} onChange={(event) => onAccept(consent.id, event.target.checked)} className="mt-0.5 size-4 accent-accent" />
      <span>{consent.label}{consent.required && <span className="text-accent"> *</span>}</span>
    </label>)}
  </section>;
}

function CartPage() {
  const { language } = useLanguage();
  const cs = language === "cs";
  const { user } = useAuth();
  const fetchEvent = useServerFn(getEventDetail);
  const fetchAccount = useServerFn(getAccountOverview);
  const startCheckout = useServerFn(startTicketCheckoutBatch);
  const [lines, setLines] = useState<TicketCartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [buyerFirstName, setBuyerFirstName] = useState("");
  const [buyerLastName, setBuyerLastName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const buyerName = [buyerFirstName.trim(), buyerLastName.trim()].join(" ");
  // TODO: Supply verified, localized event policy text and purchase-consent labels
  // from event data. Persist policy version + acknowledgements with the order and
  // validate required consent server-side before enabling this section.
  const policies: CheckoutPolicies | null = null;
  // Missing source: getEventDetail currently exposes no event terms or approved
  // consent labels. Keep the step hidden until those verified fields are provided.
  const consentScope = JSON.stringify([lines[0]?.eventSlug, language, user?.id, policies]);
  const [consentState, setConsentState] = useState<{ scope: string; accepted: Record<string, boolean> }>({ scope: "", accepted: {} });
  const acceptedConsents = consentState.scope === consentScope ? consentState.accepted : {};
  const consentComplete = requiredPoliciesAccepted(policies, acceptedConsents);
  // TODO: Coupon/gift-card UI requires validated server quotes and redemption.
  // Show a reservation timer only for an actual server-issued hold + expiresAt;
  // browsing this cart does not reserve tickets. Never create a cosmetic timer.

  function eventSchedule(event: { startDate: string; endDate: string | null }) {
    const options = { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zurich" } as const;
    const start = new Date(event.startDate).toLocaleString(cs ? "cs-CZ" : "en-GB", options);
    return event.endDate ? `${start} – ${new Date(event.endDate).toLocaleString(cs ? "cs-CZ" : "en-GB", options)}` : start;
  }

  useEffect(() => {
    setLines(readTicketCart());
    setReady(true);
  }, []);

  const groups = [...new Set(lines.map((line) => line.eventSlug))];
  const selectedLines = lines;
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
    setBuyerFirstName(profile.firstName ?? "");
    setBuyerLastName(profile.lastName ?? "");
    setBuyerEmail(profile.email ?? user?.email ?? "");
  }, [accountQuery.data, user?.email]);

  const groupReadiness = groups.map((slug, index) => {
    const detail = eventQueries[index]?.data;
    const eventLines = lines.filter((line) => line.eventSlug === slug);
    const tickets = eventLines.map((line) => ({ ticket: detail?.tickets.find((item) => item.id === line.ticketId) }));
    const currencies = new Set(tickets.flatMap(({ ticket }) => ticket ? [ticket.price.currency] : []));
    const purchasable = !!detail && detail.registrationOpen && currencies.size <= 1 && tickets.length > 0 && tickets.every(({ ticket }) =>
      ticket && ticket.price.eligible && !ticket.soldOut &&
      (!ticket.saleStart || Date.parse(ticket.saleStart) <= Date.now()) &&
      (!ticket.saleEnd || Date.parse(ticket.saleEnd) > Date.now()),
    );
    return { slug, purchasable, free: purchasable && tickets.every(({ ticket }) => ticket!.price.finalPrice === 0) };
  });
  const cartCurrencies = new Set(eventQueries.flatMap((query, index) => lines.filter((line) => line.eventSlug === groups[index]).flatMap((line) => {
    const ticket = query.data?.tickets.find((item) => item.id === line.ticketId);
    return ticket ? [ticket.price.currency] : [];
  })));
  const currencyCompatible = cartCurrencies.size <= 1;
  const checkoutMutation = useMutation({
    mutationFn: () => {
      const events = groups.map((slug) => ({ eventSlug: slug, lines: lines.filter((line) => line.eventSlug === slug).map((line) => ({
        ticketId: line.ticketId, quantity: line.quantity,
        attendees: Array.from({ length: line.quantity }, (_, index) => {
          const attendee = line.attendees?.[index];
          const singleTicket = lines.reduce((sum, item) => sum + item.quantity, 0) === 1;
          return { firstName: attendee?.firstName || (singleTicket ? buyerFirstName : ""), lastName: attendee?.lastName || (singleTicket ? buyerLastName : "") };
        }),
      })) }));
      return startCheckout({ data: { events, termsAccepted: true, ...(!user ? { buyerName, buyerEmail } : {}) } });
    },
    onSuccess: (result) => {
      trackEvent(result.url ? "ticket_checkout_started" : "free_ticket_issued", { event_count: groups.length });
      if (result.url) { window.location.assign(result.url); return; }
      saveCart([]);
      if (result.accessUrl) { window.location.assign(result.accessUrl); return; }
      toast.success(cs ? "Vstupenka je potvrzena. Najdete ji v Můj CometX." : "Your ticket is confirmed. See it in My CometX.");
      window.location.assign(user ? `/account/events?purchase=success&batch=${encodeURIComponent(result.batchId)}` : "/events");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function submitCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!termsAccepted || !consentComplete || !groupReadiness.length || groupReadiness.some((group) => !group.purchasable)) return;
    if (buyerNameConflicts.size > 0) {
      toast.error(cs ? "Pro každou akci může být kupující uveden jen na jedné vstupence." : "The buyer can be named on only one ticket per event.");
      return;
    }
    if (!user && (!buyerFirstName.trim() || !buyerLastName.trim() || buyerName.length > 240)) {
      toast.error(cs ? "Vyplňte jméno a příjmení (celkem nejvýše 240 znaků)." : "Enter your first and last name (up to 240 characters combined).");
      return;
    }
    checkoutMutation.mutate();
  }

  const totalTickets = selectedLines.reduce((sum, line) => sum + line.quantity, 0);
  const buyer = { firstName: buyerFirstName, lastName: buyerLastName };
  const buyerNameConflicts = new Set(groups.filter((slug) => buyerNamedAttendeeCount(lines, slug, buyer) > 1));
  const attendeeComplete = selectedLines.every((line) => Array.from({ length: line.quantity }, (_, index) => line.attendees?.[index]).every((person) =>
    (person?.firstName.trim() || (totalTickets === 1 && buyerFirstName.trim())) && (person?.lastName.trim() || (totalTickets === 1 && buyerLastName.trim()))));
  const checkoutAllowed = termsAccepted && attendeeComplete && buyerNameConflicts.size === 0 && consentComplete && currencyCompatible && groupReadiness.length > 0 && groupReadiness.every((group) => group.purchasable) && !checkoutMutation.isPending &&
    (user ? !accountQuery.isLoading : !!buyerFirstName.trim() && !!buyerLastName.trim() && !!buyerEmail.trim());
  function saveCart(next: TicketCartLine[]) {
    writeTicketCart(next);
    setLines(readTicketCart());
  }

  function changeQuantity(line: TicketCartLine, quantity: number) {
    const eventTotal = lines.filter((item) => item.eventSlug === line.eventSlug && item.ticketId !== line.ticketId)
      .reduce((sum, item) => sum + item.quantity, 0);
    const nextQuantity = Math.max(0, Math.min(quantity, 10 - eventTotal));
    saveCart(nextQuantity === 0
      ? lines.filter((item) => !(item.eventSlug === line.eventSlug && item.ticketId === line.ticketId))
      : lines.map((item) => item.eventSlug === line.eventSlug && item.ticketId === line.ticketId ? { ...item, quantity: nextQuantity, attendees: item.attendees?.slice(0, nextQuantity) ?? [] } : item));
  }

  function updateAttendee(line: TicketCartLine, index: number, field: "firstName" | "lastName", value: string) {
    saveCart(lines.map((item) => item.eventSlug === line.eventSlug && item.ticketId === line.ticketId ? {
      ...item, attendees: Array.from({ length: item.quantity }, (_, slot) => ({ firstName: "", lastName: "", ...item.attendees?.[slot], ...(slot === index ? { [field]: value } : {}) })),
    } : item));
  }

  function useBuyerNameForAttendee(line: TicketCartLine, index: number) {
    if (!buyerFirstName.trim() || !buyerLastName.trim()) return;
    saveCart(copyBuyerNameToAttendee(lines, line, index, { firstName: buyerFirstName, lastName: buyerLastName }));
  }

  function clearBuyerNameForAttendee(line: TicketCartLine, index: number) {
    saveCart(clearAttendeeName(lines, line, index));
  }

  if (!ready) return <Section><LoadingBlock label={cs ? "Načítáme košík" : "Loading your cart"} /></Section>;

  return <>
    <PageHero eyebrow={cs ? "Vstupenky" : "Tickets"} title={cs ? "Váš košík" : "Your cart"}
      lead={cs ? "Zkontrolujte vstupenky a dokončete objednávku." : "Review your tickets and complete your order."} />
    <Section>
      {lines.length === 0 ? <div className="rounded-3xl bg-card p-8 text-center sm:p-12">
        <ShoppingCart className="mx-auto size-8 text-accent" />
        <h2 className="mt-4 font-display text-2xl font-bold">{cs ? "V košíku zatím nic není" : "Your cart is empty"}</h2>
        <p className="mt-2 text-muted-foreground">{cs ? "Vyberte počet vstupenek na stránce akce a přidejte je sem." : "Choose a ticket quantity on an event page and add it here."}</p>
        <Button asChild variant="signal" className="mt-6"><Link to="/events">{cs ? "Prohlédnout akce" : "Browse events"}<ArrowRight className="size-4" /></Link></Button>
      </div> : <form className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-10" onSubmit={submitCheckout}>
        <div className="space-y-5">
          <section className="rounded-[1.5rem] bg-card p-5 sm:p-7">
            <h2 className="font-display text-2xl font-bold"><span className="text-accent">1.</span> {cs ? "Kontaktní údaje" : "Contact details"}</h2>
            {user ? <>
              {accountQuery.isLoading ? <div className="mt-4"><LoadingBlock label={cs ? "Načítáme váš účet" : "Loading your account"} /></div> : <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium">{cs ? "Jméno" : "First name"} <span className="text-accent">*</span><Input className="mt-2 min-h-12 rounded-2xl border-0 bg-background/70 px-4" autoComplete="given-name" value={buyerFirstName} readOnly /></label>
                <label className="block text-sm font-medium">{cs ? "Příjmení" : "Last name"} <span className="text-accent">*</span><Input className="mt-2 min-h-12 rounded-2xl border-0 bg-background/70 px-4" autoComplete="family-name" value={buyerLastName} readOnly /></label>
                <label className="block text-sm font-medium sm:col-span-2">Email <span className="text-accent">*</span><Input className="mt-2 min-h-12 rounded-2xl border-0 bg-background/70 px-4" type="email" autoComplete="email" value={buyerEmail || user.email || ""} readOnly /></label>
              </div>}
            </> : <>
              <p className="mt-2 text-sm text-muted-foreground">{cs ? "Vyplňte povinné údaje pro vstupenky." : "Enter the required details for your tickets."} {cs ? "Již máte účet?" : "Already have an account?"} <Link to="/login" className="font-medium text-accent underline underline-offset-4">{cs ? "Přihlásit se" : "Log in"}</Link></p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium">{cs ? "Jméno" : "First name"} <span className="text-accent">*</span><Input className="mt-2 min-h-12 rounded-2xl border-0 bg-background/70 px-4" autoComplete="given-name" required maxLength={240} value={buyerFirstName} onChange={(event) => setBuyerFirstName(event.target.value)} /></label>
                <label className="block text-sm font-medium">{cs ? "Příjmení" : "Last name"} <span className="text-accent">*</span><Input className="mt-2 min-h-12 rounded-2xl border-0 bg-background/70 px-4" autoComplete="family-name" required maxLength={240} value={buyerLastName} onChange={(event) => setBuyerLastName(event.target.value)} /></label>
                <label className="block text-sm font-medium sm:col-span-2">Email <span className="text-accent">*</span><Input className="mt-2 min-h-12 rounded-2xl border-0 bg-background/70 px-4" type="email" autoComplete="email" required maxLength={320} value={buyerEmail} onChange={(event) => setBuyerEmail(event.target.value)} /></label>
              </div>
            </>}
          </section>
          <h2 className="px-1 font-display text-xl font-bold"><span className="text-accent">2.</span> {cs ? "Vstupenky a účastníci" : "Tickets and attendees"}</h2>
          {eventQueries.map((query, index) => {
            const slug = groups[index]!;
            const eventLines = lines.filter((line) => line.eventSlug === slug);
            if (query.isLoading) return <div key={slug} className="rounded-3xl bg-card p-6"><LoadingBlock label={cs ? "Načítáme vstupenky" : "Loading tickets"} /></div>;
            if (query.error) return <div key={slug} className="rounded-3xl bg-card p-6"><ErrorBlock error={query.error} /></div>;
            const detail = query.data;
            if (!detail) return null;
            const ticketRows = eventLines.map((line) => {
              const ticket = detail.tickets.find((item) => item.id === line.ticketId);
              if (!ticket) return { line, ticket: null, saleOpen: false };
              const saleOpen = (!ticket.saleStart || Date.parse(ticket.saleStart) <= Date.now()) && (!ticket.saleEnd || Date.parse(ticket.saleEnd) > Date.now());
              return { line, ticket, saleOpen };
            });
            const currencies = new Set(ticketRows.flatMap(({ ticket }) => ticket ? [ticket.price.currency] : []));
            const sameCurrency = currencies.size <= 1;
            const purchasable = detail.registrationOpen && sameCurrency && ticketRows.every(({ ticket, saleOpen }) => ticket && ticket.price.eligible && !ticket.soldOut && saleOpen);
            return <article key={slug} className="rounded-[1.5rem] bg-card/55 p-3 sm:p-4">
              <div className="mb-2 hidden grid-cols-[minmax(0,1fr)_6.25rem_7.5rem_6rem_1.5rem] items-center gap-3 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground xl:grid">
                <span>{cs ? "Akce / vstupenka" : "Event / ticket"}</span>
                <span>{cs ? "Cena za kus" : "Unit price"}</span>
                <span>{cs ? "Počet" : "Quantity"}</span>
                <span className="text-right">{cs ? "Celkem" : "Line total"}</span>
                <span className="sr-only">{cs ? "Odebrat" : "Remove"}</span>
              </div>
              <div className="divide-y divide-foreground/5">
                {ticketRows.map(({ line, ticket, saleOpen }) => <div key={line.ticketId} className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-2 py-3 sm:px-3 xl:grid-cols-[minmax(0,1fr)_6.25rem_7.5rem_6rem_1.5rem] xl:gap-3 xl:py-2.5">
                  <div className="col-span-2 flex min-w-0 items-center gap-3 pr-9 xl:col-span-1 xl:pr-0">
                    {detail.event.heroImageUrl && <img src={detail.event.heroImageUrl} alt="" className="size-14 shrink-0 rounded-xl object-cover" />}
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold"><Link to="/events/$slug" params={{ slug }} className="hover:text-accent">{detail.event.title}</Link></h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">{eventSchedule(detail.event)}</p>
                      {detail.event.venue && <p className="mt-0.5 text-xs text-muted-foreground">{detail.event.venue}</p>}
                      <p className="mt-0.5 truncate text-xs font-medium">{ticket?.name ?? (cs ? "Vstupenka již není dostupná" : "Ticket no longer available")}</p>
                      {ticket && (!detail.registrationOpen || !saleOpen || ticket.soldOut || !ticket.price.eligible) && <p className="mt-1 text-xs text-destructive">{cs ? "Tento typ vstupenky už nelze koupit." : "This ticket type is no longer available."}</p>}
                    </div>
                  </div>
                  <div className="text-sm tabular-nums xl:text-base">
                    <span className="mr-2 text-xs text-muted-foreground xl:hidden">{cs ? "Cena" : "Price"}</span>
                    <span className="font-medium">{ticket ? formatMoney(ticket.price.finalPrice, ticket.price.currency) : "—"}</span>
                    {ticket && <p className="mt-1 text-[10px] text-muted-foreground">{formatMembershipBenefit(ticket.price, cs)}</p>}
                    {ticket && ticket.price.finalPrice !== ticket.price.basePrice && <p className="text-[10px] text-muted-foreground">{cs ? "Veřejná" : "Public"}: {formatMoney(ticket.price.basePrice, ticket.price.currency)}</p>}
                  </div>
                  <div className="flex items-center justify-between xl:justify-start">
                    <span className="text-xs text-muted-foreground xl:hidden">{cs ? "Počet" : "Quantity"}</span>
                    <div className="inline-flex items-center gap-0.5 rounded-full bg-background/60 p-0.5">
                      <button type="button" aria-label={cs ? "Odebrat jednu vstupenku" : "Remove one ticket"} className="grid size-8 place-items-center rounded-full text-foreground/70 transition-colors hover:bg-accent/20 hover:text-foreground" onClick={() => changeQuantity(line, line.quantity - 1)}><Minus className="size-3" /></button>
                      <span className="min-w-7 text-center text-sm font-semibold tabular-nums">{line.quantity}</span>
                      <button type="button" aria-label={cs ? "Přidat jednu vstupenku" : "Add one ticket"} className="grid size-8 place-items-center rounded-full text-foreground/70 transition-colors hover:bg-accent/20 hover:text-foreground" disabled={!ticket || ticket.soldOut || line.quantity + eventLines.filter((item) => item.eventSlug === line.eventSlug && item.ticketId !== line.ticketId).reduce((sum, item) => sum + item.quantity, 0) >= 10} onClick={() => changeQuantity(line, line.quantity + 1)}><Plus className="size-3" /></button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between xl:block xl:text-right">
                    <span className="text-xs text-muted-foreground xl:hidden">{cs ? "Celkem" : "Line total"}</span>
                    <span className="text-sm font-bold tabular-nums">{ticket ? formatMoney(ticket.price.finalPrice * line.quantity, ticket.price.currency) : "—"}</span>
                  </div>
                  <button type="button" aria-label={cs ? "Odebrat vstupenku" : "Remove ticket"} title={cs ? "Odebrat vstupenku" : "Remove ticket"} className="absolute right-2 top-2 grid size-7 place-items-center rounded-full text-muted-foreground/65 transition-colors hover:bg-background hover:text-foreground xl:static" onClick={() => changeQuantity(line, 0)}><Trash2 className="size-3.5" /></button>
                  <div className="col-span-full w-full space-y-4 py-3">
                    {Array.from({ length: line.quantity }, (_, index) => <fieldset key={index} className="grid gap-3 sm:grid-cols-2">
                      <legend className="mb-2 text-sm font-semibold">{ticket?.name} · {cs ? "Účastník" : "Attendee"} {index + 1}</legend>
                      <label className="text-sm">{cs ? "Jméno" : "First name"} *<Input required maxLength={120} autoComplete="off" className="mt-1 rounded-xl" value={line.attendees?.[index]?.firstName ?? (totalTickets === 1 ? buyerFirstName : "")} onChange={(event) => updateAttendee(line, index, "firstName", event.target.value)} /></label>
                      <label className="text-sm">{cs ? "Příjmení" : "Last name"} *<Input required maxLength={120} autoComplete="off" className="mt-1 rounded-xl" value={line.attendees?.[index]?.lastName ?? (totalTickets === 1 ? buyerLastName : "")} onChange={(event) => updateAttendee(line, index, "lastName", event.target.value)} /></label>
                      {index === 0 && eventLines[0]?.ticketId === line.ticketId && <button type="button" className="justify-self-start text-sm text-accent underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2" aria-pressed={attendeeMatchesBuyer(line.attendees?.[index], buyer)} disabled={!buyerFirstName.trim() || !buyerLastName.trim()} onClick={() => attendeeMatchesBuyer(line.attendees?.[index], buyer) ? clearBuyerNameForAttendee(line, index) : useBuyerNameForAttendee(line, index)}>{attendeeMatchesBuyer(line.attendees?.[index], buyer) ? (cs ? "Odebrat jméno kupujícího" : "Remove buyer’s name") : (cs ? "Použít jméno kupujícího pro tuto vstupenku" : "Use buyer’s name for this ticket")}</button>}
                    </fieldset>)}
                  </div>
                </div>)}
              </div>
              {!sameCurrency && <p className="mt-3 text-sm text-destructive">{cs ? "V jedné objednávce nelze kombinovat různé měny. Odeberte některý typ vstupenky." : "Ticket types in one order must use the same currency. Remove one currency type."}</p>}
              {!purchasable && <p className="mt-3 text-sm text-destructive">{cs ? "Některé vstupenky nejsou dostupné. Upravte košík nebo vyberte jinou akci." : "Some tickets are unavailable. Update your cart or choose another event."}</p>}
              {buyerNameConflicts.has(slug) && <p className="mt-3 text-sm text-destructive">{cs ? "Kupující může být uveden jen na jedné vstupence pro tuto akci. Upravte dalšího účastníka nebo zvolte, která vstupenka je pro kupujícího." : "The buyer can be named on only one ticket for this event. Edit the other attendee or choose which ticket is for the buyer."}</p>}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-foreground/10 pt-4">
                <p className="font-semibold">{cs ? "Mezisoučet akce" : "Event subtotal"}: {sameCurrency && ticketRows.every(({ ticket }) => ticket) ? formatMoney(ticketRows.reduce((sum, { line, ticket }) => sum + ticket!.price.finalPrice * line.quantity, 0), ticketRows[0]!.ticket!.price.currency) : "—"}</p>
              </div>
            </article>;
          })}
          <EventPolicies policies={policies} cs={cs} accepted={acceptedConsents} onAccept={(id, checked) => setConsentState((previous) => ({
            scope: consentScope,
            accepted: { ...(previous.scope === consentScope ? previous.accepted : {}), [id]: checked },
          }))} />
          <section className="rounded-3xl bg-card/70 px-5 py-4">
            <h3 className="font-display font-semibold"><span className="text-accent">3.</span> {cs ? "Podmínky nákupu" : "Purchase terms"}</h3>
            <label className="mt-3 flex items-start gap-3 text-sm">
              <input type="checkbox" required checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-0.5 size-4 accent-accent" />
              <span>{cs ? "Souhlasím s obchodními podmínkami a potvrzuji, že jsem si přečetl/a zásady ochrany soukromí." : "I accept the Terms & Conditions and confirm that I have read the Privacy Policy."}<span className="text-accent"> *</span>
                <span className="mt-1 flex gap-4"><a className="text-accent underline underline-offset-2" target="_blank" rel="noreferrer noopener" href="https://www.cometx.ch/_files/ugd/41f758_b4416cc4324a440fae43acc5bf10defd.pdf">{cs ? "Obchodní podmínky" : "Terms & Conditions"}</a><a className="text-accent underline underline-offset-2" target="_blank" rel="noreferrer noopener" href="https://www.cometx.ch/_files/ugd/41f758_cf8654296bfe4790be7ac44abfe07fbd.pdf">{cs ? "Ochrana soukromí" : "Privacy Policy"}</a></span>
              </span>
            </label>
          </section>
        </div>

        <aside className="rounded-[1.75rem] bg-card p-5 sm:p-6 lg:sticky lg:top-28">
          <div className="space-y-5">
            <h2 className="font-display text-xl font-bold">{cs ? "Shrnutí objednávky" : "Order summary"}</h2>
            <div className="space-y-5">
              {eventQueries.map((query, index) => {
                const eventSlug = groups[index]!;
                const eventLines = lines.filter((line) => line.eventSlug === eventSlug);
                const detail = query.data;
                if (!detail) return null;
                return <div key={eventSlug} className="space-y-2 rounded-2xl bg-background/45 p-4 text-sm">
                  <p className="font-semibold">{detail.event.title}</p>
                  <p className="text-xs text-muted-foreground">{eventSchedule(detail.event)}</p>
                  {detail.event.venue && <p className="text-xs text-muted-foreground">{detail.event.venue}</p>}
                  {eventLines.map((line) => {
                    const ticket = detail.tickets.find((item) => item.id === line.ticketId);
                    return <div key={line.ticketId} className="flex items-start justify-between gap-3 border-t border-foreground/5 pt-3 text-xs"><div className="min-w-0"><p className="font-medium">{ticket?.name ?? (cs ? "Vstupenka" : "Ticket")}</p>{ticket && ticket.price.benefitType !== "public" && <p className="mt-1 text-muted-foreground">{cs ? "Běžná cena" : "Regular price"}: {formatMoney(ticket.price.basePrice, ticket.price.currency)} · {formatMembershipBenefit(ticket.price, cs)}</p>}<p className="mt-1 text-muted-foreground">{line.quantity} × {ticket ? formatMoney(ticket.price.finalPrice, ticket.price.currency) : "—"}</p></div><span className="shrink-0 font-semibold tabular-nums">{ticket ? formatMoney(ticket.price.finalPrice * line.quantity, ticket.price.currency) : "—"}</span></div>;
                  })}
                </div>;
              })}
            </div>
          {(() => {
            const pricedLines = selectedLines.map((line) => ({ line, ticket: eventQueries[groups.indexOf(line.eventSlug)]?.data?.tickets.find((ticket) => ticket.id === line.ticketId) }));
            const currencies = [...new Set(pricedLines.flatMap(({ ticket }) => ticket ? [ticket.price.currency] : []))];
            const amount = currencies.length === 1 && pricedLines.every(({ ticket }) => ticket)
              ? formatMoney(pricedLines.reduce((total, { line, ticket }) => total + ticket!.price.finalPrice * line.quantity, 0), currencies[0]!) : "—";
            return <div className="space-y-3 border-t border-foreground/10 pt-4">
              <h3 className="font-display text-lg font-semibold"><span className="text-accent">4.</span> {cs ? "Kontrola a platba" : "Review and payment"}</h3>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">{cs ? "Mezisoučet" : "Subtotal"}</span>
                <span className="text-right font-medium tabular-nums">{amount}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-foreground/10 pt-3">
                <span className="font-semibold">{cs ? "Celkem" : "Total"}</span>
                <span className="text-right text-2xl font-bold tabular-nums">{amount}</span>
              </div>
            </div>;
          })()}
          <Button type="submit" variant="signal" className="mt-3 min-h-12 w-full rounded-full disabled:opacity-100" disabled={!checkoutAllowed}>
            {checkoutMutation.isPending ? (cs ? "Připravujeme…" : "Preparing…") : (cs ? "Pokračovat k platbě" : "Continue to payment")}<ArrowRight className="size-4" />
          </Button>
          {!currencyCompatible && <p className="text-sm text-destructive">{cs ? "V jedné objednávce lze kombinovat pouze vstupenky se stejnou měnou." : "Tickets in one purchase must use the same currency."}</p>}
          </div>
        </aside>
      </form>}
    </Section>
  </>;
}
