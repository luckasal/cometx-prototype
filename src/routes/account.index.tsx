import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAccountOverview } from "@/lib/membership.functions";
import { getMyPurchasedTickets } from "@/lib/ticket-orders.functions";
import { formatMoney } from "@/lib/pricing";
import { formatMembershipBenefit } from "@/lib/membership-benefit-catalog";
import { isIssuedTicketStatus, isOwnedOrderLine, isUpcomingEvent } from "@/lib/ticket-status";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { EmptyBlock, ErrorBlock, LoadingBlock, Section, StatusPill } from "@/components/site/Bits";

export const Route = createFileRoute("/account/")({
  component: AccountOverviewPage,
});

function AccountOverviewPage() {
  const { language } = useLanguage();
  const cs = language === "cs";
  const locale = cs ? "cs-CZ" : "en-GB";
  const fetchOverview = useServerFn(getAccountOverview);
  const fetchTickets = useServerFn(getMyPurchasedTickets);
  const { data, isLoading, error } = useQuery({
    queryKey: ["account"],
    queryFn: () => fetchOverview(),
  });
  const {
    data: orders,
    error: ticketError,
    isLoading: ticketsLoading,
  } = useQuery({
    queryKey: ["account", "tickets"],
    queryFn: () => fetchTickets(),
  });

  if (isLoading)
    return (
      <Section>
        <LoadingBlock label={cs ? "Načítáme váš účet" : "Loading your account"} />
      </Section>
    );
  if (error)
    return (
      <Section>
        <ErrorBlock error={error} />
      </Section>
    );
  if (!data) return null;

  // A legacy "confirmed" registration could have been created without payment.
  // Only an issued ticket establishes ownership on the account overview.
  const upcomingEvents = [
    ...(orders ?? []).flatMap((order) =>
      (order.ticket_order_items ?? [])
        .filter(
          (item) =>
            isOwnedOrderLine(order.status, item.ticket_attendees) &&
            !!item.events?.[0]?.start_date &&
            isUpcomingEvent(item.events[0].start_date),
        )
        .map((item) => ({
          id: `ticket:${item.id}`,
          eventTitle: item.events[0]!.title,
          eventSlug: item.events[0]!.slug,
          startDate: item.events[0]!.start_date,
          ticketName: item.ticket_name,
          status: order.status,
          amount:
            (Number(item.unit_amount_minor) *
              (item.ticket_attendees?.filter((ticket) => isIssuedTicketStatus(ticket.status))
                .length ?? 0)) /
            100,
          currency: item.currency,
        })),
    ),
  ].sort((left, right) => Date.parse(left.startDate) - Date.parse(right.startDate));

  return (
    <main className="min-h-[70vh] bg-muted">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:py-14 lg:px-8 lg:py-16">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow text-muted-foreground">
              CometX · {cs ? "Můj účet" : "My account"}
            </p>
            <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
              {cs ? "Ahoj" : "Hello"},{" "}
              {data.profile.firstName || data.profile.lastName || data.profile.email}
            </h1>
          </div>
          <Link
            to="/account/profile"
            className="inline-flex min-h-11 items-center rounded-full border border-foreground px-5 font-semibold transition hover:bg-background"
          >
            {cs ? "Upravit moje údaje" : "Edit my details"}
          </Link>
        </header>

        <nav
          aria-label={cs ? "Sekce účtu" : "Account sections"}
          className="mb-7 flex flex-wrap gap-2"
        >
          <Link
            to="/account"
            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-ink-foreground"
            aria-current="page"
          >
            {cs ? "Přehled" : "Overview"}
          </Link>
          <Link
            to="/account/events"
            className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold"
          >
            {cs ? "Vstupenky" : "Tickets"}
          </Link>
          <Link
            to="/account/membership"
            className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold"
          >
            {cs ? "Členství" : "Membership"}
          </Link>
          <Link
            to="/account/profile"
            className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold"
          >
            {cs ? "Moje údaje" : "My details"}
          </Link>
        </nav>

        <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <section
            className="rounded-3xl bg-card p-6 sm:p-8"
            aria-labelledby="account-tickets-title"
          >
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow text-muted-foreground">{cs ? "Vstupenky" : "Tickets"}</p>
                <h2
                  id="account-tickets-title"
                  className="mt-2 font-display text-2xl font-extrabold sm:text-3xl"
                >
                  {cs ? "Moje nadcházející akce" : "My upcoming events"}
                </h2>
              </div>
              <Link
                to="/account/events"
                className="text-sm font-bold underline decoration-accent decoration-2 underline-offset-4"
              >
                {cs ? "Všechny vstupenky" : "All tickets"} →
              </Link>
            </div>
            {ticketError && (
              <ErrorBlock
                error={
                  new Error(
                    cs
                      ? "Nepodařilo se načíst vaše vstupenky. Zkuste to znovu."
                      : "We couldn't load your tickets. Please try again.",
                  )
                }
              />
            )}
            {ticketsLoading && upcomingEvents.length === 0 ? (
              <LoadingBlock label={cs ? "Načítáme vstupenky" : "Loading your tickets"} />
            ) : upcomingEvents.length === 0 && !ticketError ? (
              <EmptyBlock
                title={
                  cs ? "Nemáte žádné nadcházející potvrzené akce" : "No upcoming confirmed events"
                }
                hint={
                  cs
                    ? "Prohlédněte si akce CometX a vyberte si další setkání."
                    : "Browse CometX events to find your next gathering."
                }
              />
            ) : upcomingEvents.length > 0 ? (
              <ul className="space-y-3">
                {upcomingEvents.map((reg) => (
                  <li
                    key={reg.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-background p-4 sm:p-5"
                  >
                    <div className="min-w-0">
                      <Link
                        to="/events/$slug"
                        params={{ slug: reg.eventSlug }}
                        className="font-display text-lg font-bold hover:underline"
                      >
                        {reg.eventTitle}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(reg.startDate).toLocaleDateString(locale, {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                        {reg.ticketName ? ` · ${reg.ticketName}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <StatusPill tone="success">
                        {cs && reg.status === "paid" ? "Zaplaceno" : reg.status}
                      </StatusPill>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {reg.amount === 0
                          ? cs
                            ? "Zdarma"
                            : "Free"
                          : formatMoney(reg.amount, reg.currency)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <aside className="space-y-5">
            <section
              className="overflow-hidden rounded-3xl bg-ink text-ink-foreground"
              aria-labelledby="account-membership-title"
            >
              <div className="p-6 sm:p-7">
                <p className="eyebrow text-accent">{cs ? "Členství" : "Membership"}</p>
                <h2
                  id="account-membership-title"
                  className="mt-2 font-display text-2xl font-extrabold"
                >
                  {data.membership
                    ? data.membership.planName
                    : cs
                      ? "Nemáte aktivní členství"
                      : "No active membership"}
                </h2>
                {data.membership ? (
                  <>
                    <div className="mt-4">
                      <StatusPill tone="signal">
                        {cs && data.membership.status === "active"
                          ? "Aktivní"
                          : data.membership.status}
                      </StatusPill>
                    </div>
                    {data.membership.endsAt && (
                      <p className="mt-3 text-sm text-ink-foreground/70">
                        {cs ? "Platné do" : "Valid until"}{" "}
                        {new Date(data.membership.endsAt).toLocaleDateString(locale, {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    )}
                    <ul className="mt-5 space-y-2 border-t border-ink-foreground/20 pt-5 text-sm">
                      {data.membership.benefits.map((benefit) => (
                        <li key={benefit.key}>{formatMembershipBenefit(benefit, language)}</li>
                      ))}
                    </ul>
                    <Button asChild variant="signal" className="mt-6 w-full">
                      <Link to="/account/membership">
                        {cs ? "Podrobnosti členství" : "Membership details"}
                      </Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="mt-3 text-sm text-ink-foreground/75">
                      {cs
                        ? "Aktuální plány a jejich výhody najdete v nabídce členství."
                        : "See current plans and benefits on the membership page."}
                    </p>
                    <Button asChild variant="signal" className="mt-6 w-full">
                      <Link to="/membership">{cs ? "Prohlédnout plány" : "Explore plans"}</Link>
                    </Button>
                  </>
                )}
              </div>
            </section>

            <section
              className="rounded-3xl bg-card p-6 sm:p-7"
              aria-labelledby="account-profile-title"
            >
              <p className="eyebrow text-muted-foreground">{cs ? "Moje údaje" : "My details"}</p>
              <h2 id="account-profile-title" className="mt-2 font-display text-xl font-extrabold">
                {data.profile.firstName || data.profile.lastName
                  ? `${data.profile.firstName ?? ""} ${data.profile.lastName ?? ""}`.trim()
                  : cs
                    ? "Profil člena"
                    : "Member profile"}
              </h2>
              <dl className="mt-4 space-y-2 text-sm text-muted-foreground">
                {data.profile.email && (
                  <div>
                    <dt className="sr-only">Email</dt>
                    <dd>{data.profile.email}</dd>
                  </div>
                )}
                {data.profile.company && (
                  <div>
                    <dt className="sr-only">{cs ? "Společnost" : "Company"}</dt>
                    <dd>{data.profile.company}</dd>
                  </div>
                )}
                {data.profile.jobTitle && (
                  <div>
                    <dt className="sr-only">{cs ? "Pozice" : "Job title"}</dt>
                    <dd>{data.profile.jobTitle}</dd>
                  </div>
                )}
                {data.profile.country && (
                  <div>
                    <dt className="sr-only">{cs ? "Země" : "Country"}</dt>
                    <dd>{data.profile.country}</dd>
                  </div>
                )}
              </dl>
              <Link
                to="/account/profile"
                className="mt-5 inline-flex text-sm font-bold underline decoration-accent decoration-2 underline-offset-4"
              >
                {cs ? "Upravit profil" : "Edit profile"} →
              </Link>
            </section>

            <section
              className="rounded-3xl border border-border bg-card p-6 sm:p-7"
              aria-labelledby="account-directory-title"
            >
              <h2 id="account-directory-title" className="font-display text-xl font-extrabold">
                {cs ? "Veřejný profil" : "Public profile"}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {cs
                  ? "Veřejný adresář ukazuje jen vybrané údaje po výslovném zveřejnění týmem CometX. E-mail a telefon se nezobrazují."
                  : "The public directory shows selected details only after explicit publication by the CometX team. Email and phone are not shown."}
              </p>
              <Link
                to="/community/members"
                className="mt-4 inline-flex text-sm font-bold underline decoration-accent decoration-2 underline-offset-4"
              >
                {cs ? "Adresář členů" : "Member directory"} →
              </Link>
            </section>

            {data.hasStaffAccess && (
              <section className="rounded-3xl border border-border bg-card p-6 sm:p-7">
                <p className="eyebrow text-muted-foreground">{cs ? "Tým CometX" : "Staff"}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {cs
                    ? "Máte přístup do Back Office CometX. Dostupné sekce závisí na vaší roli."
                    : "You have staff access to the CometX Back Office. Available sections depend on your role."}
                </p>
                <Button asChild variant="ink" className="mt-4 w-full">
                  <Link to="/admin">{cs ? "Otevřít Back Office" : "Open admin"}</Link>
                </Button>
              </section>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
