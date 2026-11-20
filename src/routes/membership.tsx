import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowDown, Check, ExternalLink } from "lucide-react";
import {
  getMembershipPlans,
  getMembershipSavingsEvents,
  startMembershipCheckout,
} from "@/lib/membership.functions";
import { formatMoney } from "@/lib/pricing";
import { formatMembershipBenefit } from "@/lib/membership-benefit-catalog";
import { Button } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock } from "@/components/site/Bits";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { trackEvent } from "@/lib/analytics";
import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listPartners } from "@/lib/public.functions";

export const Route = createFileRoute("/membership")({
  head: () => ({
    meta: [
      { title: "Membership - CometX" },
      {
        name: "description",
        content:
          "Fanousek, CometXXL or Ambasador: three CometX memberships with event pricing, symposium access and workshop credit.",
      },
      { property: "og:title", content: "CometX membership" },
      {
        property: "og:description",
        content: "Three tiers, one community. Compare benefits and join CometX.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MembershipPage,
});

function MembershipPage() {
  useEffect(() => {
    trackEvent("membership_view");
  }, []);
  const { language } = useLanguage();
  const cs = language === "cs";
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<{
    slug: string;
    name: string;
    annualPrice: number;
    currency: string;
    setupFee: number;
  } | null>(null);
  const [application, setApplication] = useState({
    nationality: "",
    motivation: "",
    missingFromSubscription: "",
  });
  const [requestedSmallEventCount, setRequestedSmallEventCount] = useState(3);
  const fetchPlans = useServerFn(getMembershipPlans);
  const fetchSavingsEvents = useServerFn(getMembershipSavingsEvents);
  const fetchPartners = useServerFn(listPartners);
  const startCheckout = useServerFn(startMembershipCheckout);

  const { data, isLoading, error } = useQuery({
    queryKey: ["plans"],
    queryFn: () => fetchPlans(),
  });
  const {
    data: savingsEvents = [],
    isLoading: savingsLoading,
    error: savingsError,
  } = useQuery({
    queryKey: ["membership-savings-events"],
    queryFn: () => fetchSavingsEvents(),
  });
  const {
    data: partners = [],
    isLoading: partnersLoading,
    error: partnersError,
  } = useQuery({
    queryKey: ["active-partners"],
    queryFn: () => fetchPartners(),
  });
  const { symposiumEvent, smallerEvents } = useMemo(
    () => ({
      symposiumEvent: savingsEvents.find((event) => event.eventType === "symposium"),
      smallerEvents: savingsEvents.filter((event) => event.eventType !== "symposium"),
    }),
    [savingsEvents],
  );
  const selectedSavingsEvents = useMemo(
    () => [
      ...(symposiumEvent ? [symposiumEvent] : []),
      ...smallerEvents.slice(0, requestedSmallEventCount),
    ],
    [requestedSmallEventCount, smallerEvents, symposiumEvent],
  );
  const eventCount = selectedSavingsEvents.length;
  const hostTotal = selectedSavingsEvents.reduce((total, event) => total + event.guestPrice, 0);
  const estimateRows = useMemo(() => {
    if (!data) return [];
    return data
      .filter((plan) => plan.currency.toUpperCase() === "CHF")
      .map((plan) => {
        const memberPrices = selectedSavingsEvents.map((event) => event.memberPrices[plan.slug]);
        const hasAllPrices = memberPrices.every((price) => price !== null && price !== undefined);
        const ticketTotal = hasAllPrices
          ? memberPrices.reduce((total, price) => total + (price ?? 0), 0)
          : null;
        return {
          plan,
          ticketTotal,
          firstYearTotal:
            ticketTotal === null ? null : plan.annualPrice + plan.setupFee + ticketTotal,
        };
      });
  }, [data, selectedSavingsEvents]);
  const bestPlanEstimate = useMemo(
    () =>
      estimateRows
        .filter((row) => row.firstYearTotal !== null)
        .sort((a, b) => (a.firstYearTotal ?? Infinity) - (b.firstYearTotal ?? Infinity))[0] ?? null,
    [estimateRows],
  );
  const firstYearTotal = bestPlanEstimate?.firstYearTotal ?? null;
  const savings = firstYearTotal === null ? null : hostTotal - firstYearTotal;

  const checkoutMutation = useMutation({
    mutationFn: (input: {
      planSlug: string;
      email?: string;
      nationality?: "slovak" | "czech" | "other";
      motivation?: string;
      missingFromSubscription?: string;
    }) => startCheckout({ data: input }),
    onSuccess: (result) => {
      if (result.url) window.location.href = result.url;
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <section className="bg-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 pb-10 pt-14 lg:px-8 lg:pb-12 lg:pt-14">
          <p className="eyebrow text-muted-foreground">
            {cs ? "Pro členy CometX" : "CometX membership"}
          </p>
          <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-[3.25rem]">
            {cs ? "Členství" : "Membership"}
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
            {cs
              ? "Prohlédněte si ceny a výhody jednotlivých plánů vedle sebe a vyberte si ten, který vám sedí."
              : "Compare current plan prices and benefits side by side, then choose the one that fits you."}
          </p>
        </div>
      </section>

      <section aria-labelledby="membership-calculator-title" className="bg-background pb-16">
        <div className="mx-auto max-w-[1200px] px-5 lg:px-6">
          <div className="flex flex-wrap items-center gap-8 rounded-[20px] bg-[#ececec] p-6 sm:gap-10 sm:p-10">
            <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-4">
              <h2 id="membership-calculator-title" className="font-display text-[32px] font-bold">
                {cs ? "Kolik ušetříš?" : "How much could you save?"}
              </h2>
              <p className="text-base text-[#3a3939]">
                {cs
                  ? "Na kolik menších akcí ročně chodíš? Pokud je zveřejněné, započítáme i nejbližší SCAS."
                  : "How many smaller events do you attend each year? If published, we include the next SCAS."}
              </p>
              <div
                className="flex flex-wrap gap-[10px]"
                role="radiogroup"
                aria-label={cs ? "Počet menších akcí" : "Number of smaller events"}
              >
                {Array.from({ length: 6 }, (_, count) => (
                  <label key={count} className="inline-flex cursor-pointer">
                    <input
                      type="radio"
                      name="membership-small-event-count"
                      value={count}
                      checked={requestedSmallEventCount === count}
                      onChange={() => setRequestedSmallEventCount(count)}
                      className="peer sr-only"
                    />
                    <span className="grid size-12 place-items-center rounded-[10px] border-[1.5px] border-[#c9c7c4] bg-white text-[17px] font-semibold text-[#212020] transition peer-checked:border-[#212020] peer-checked:bg-[#212020] peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#212020]">
                      {count}
                    </span>
                  </label>
                ))}
              </div>
              {!savingsLoading && requestedSmallEventCount > smallerEvents.length && (
                <p className="text-sm text-[#515151]">
                  {cs
                    ? `Zatím jsou zveřejněné ceny jen pro ${smallerEvents.length} dalších akcí.`
                    : `Published prices are currently available for ${smallerEvents.length} other events.`}
                </p>
              )}
            </div>

            <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2 rounded-2xl bg-white p-6 sm:p-7">
              {savingsLoading || isLoading ? (
                <p className="text-[15px] text-[#515151]">
                  {cs ? "Načítáme aktuální ceny…" : "Loading current prices…"}
                </p>
              ) : savingsError || error ? (
                <p className="text-[15px] text-[#515151]">
                  {cs
                    ? "Srovnání teď není dostupné. Zkuste to prosím později."
                    : "The comparison is unavailable right now. Please try again later."}
                </p>
              ) : eventCount === 0 ? (
                <p className="text-[15px] text-[#515151]">
                  {cs
                    ? "Pro aktuální výběr zatím nejsou zveřejněné ceny vstupenek."
                    : "Ticket prices for this selection have not been published yet."}
                </p>
              ) : !bestPlanEstimate || firstYearTotal === null ? (
                <p className="text-[15px] text-[#515151]">
                  {cs
                    ? "Členské ceny nejsou zveřejněné pro všechny vybrané akce."
                    : "Member ticket prices are not published for every selected event."}
                </p>
              ) : (
                <>
                  <p className="text-[15px] text-[#515151]">
                    {cs ? "Lístky" : "Tickets"}: {formatMoney(hostTotal, "CHF")} ·{" "}
                    {cs
                      ? `${bestPlanEstimate.plan.name}, 1. rok včetně vstupenek`
                      : `${bestPlanEstimate.plan.nameEn?.trim() || bestPlanEstimate.plan.name}, first year including tickets`}
                    : {formatMoney(firstYearTotal, bestPlanEstimate.plan.currency)}
                  </p>
                  {savings !== null && savings > 0 ? (
                    <p className="self-start rounded-lg bg-[#e1f03c] px-[10px] py-0.5 font-display text-3xl font-bold sm:text-4xl">
                      {cs ? "Ušetříš " : "You save "}
                      {formatMoney(savings, bestPlanEstimate.plan.currency)}
                    </p>
                  ) : savings === 0 ? (
                    <p className="font-display text-2xl font-bold text-[#212020]">
                      {cs ? "Vyjde to nastejno." : "The total comes out the same."}
                    </p>
                  ) : (
                    <p className="font-display text-2xl font-bold text-[#212020]">
                      {cs
                        ? `Vstupenky bez členství jsou levnější o ${formatMoney(Math.abs(savings ?? 0), bestPlanEstimate.plan.currency)}.`
                        : `Tickets without membership cost ${formatMoney(Math.abs(savings ?? 0), bestPlanEstimate.plan.currency)} less.`}
                    </p>
                  )}
                </>
              )}
              <p className="text-[13px] text-[#515151]">
                {cs
                  ? "Počítáme z aktuálních cen zveřejněných akcí, členských cen vstupenek, ročního poplatku a případného vstupního poplatku."
                  : "Uses current published event prices, member ticket prices, the annual plan price, and any setup fee."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="membership-plans"
        aria-labelledby="membership-plans-title"
        className="scroll-mt-20 bg-background pb-14 sm:pb-20"
      >
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow text-muted-foreground">
                {cs ? "Přehled členství" : "Membership overview"}
              </p>
              <h2 id="membership-plans-title" className="mt-2 font-display text-3xl font-extrabold">
                {cs ? "Vyberte si plán" : "Choose your plan"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {cs
                  ? "Ceny a výhody načítáme z aktuálních plánů v CometX."
                  : "Prices and benefits come from the current CometX membership plans."}
              </p>
            </div>
          </div>
          {isLoading && <LoadingBlock label={cs ? "Načítáme členství" : "Loading plans"} />}
          {error && <ErrorBlock error={error} />}
          {data && data.length === 0 && (
            <div className="rounded-3xl bg-card p-8 text-center text-muted-foreground">
              {cs
                ? "Momentálně nejsou dostupné žádné plány členství."
                : "No membership plans are available right now."}
            </div>
          )}
          {data && data.length > 0 && (
            <div className="grid items-stretch gap-5 lg:grid-cols-3">
              {data.map((plan) => (
                <article
                  key={plan.slug}
                  className="flex flex-col rounded-2xl border border-border bg-background p-6 sm:p-7"
                >
                  <div className="min-h-28">
                    <h3 className="font-display text-2xl font-bold">
                      {!cs && plan.nameEn?.trim() ? plan.nameEn : plan.name}
                    </h3>
                    {((cs ? plan.description : plan.descriptionEn) || plan.description) && (
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        {!cs && plan.descriptionEn?.trim() ? plan.descriptionEn : plan.description}
                      </p>
                    )}
                  </div>
                  <div className="mt-2 border-y border-border py-5">
                    <p className="font-display text-3xl font-bold">
                      {formatMoney(plan.annualPrice, plan.currency)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {cs ? "za rok" : "per year"}
                    </p>
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                      {cs
                        ? `Roční automatické obnovení. Jednorázový vstupní poplatek ${formatMoney(plan.setupFee, plan.currency)}.`
                        : `Renews annually. One-time setup fee: ${formatMoney(plan.setupFee, plan.currency)}.`}
                    </p>
                  </div>
                  <div className="flex-1 py-5">
                    <p className="eyebrow text-muted-foreground">
                      {cs ? "Výhody plánu" : "Plan benefits"}
                    </p>
                    {plan.benefits.length > 0 ? (
                      <ul className="mt-4 space-y-3">
                        {plan.benefits.map((benefit) => (
                          <li key={benefit.key} className="flex gap-3 text-sm leading-relaxed">
                            <Check className="mt-0.5 size-4 shrink-0 text-accent-foreground" />
                            <span>{formatMembershipBenefit(benefit, cs ? "cs" : "en")}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-4 text-sm text-muted-foreground">
                        {cs
                          ? "Výhody tohoto plánu připravujeme."
                          : "Plan benefits have not been published yet."}
                      </p>
                    )}
                  </div>
                  {user ? (
                    <Button
                      variant="signal"
                      className="mt-2 w-full"
                      data-analytics-cta={`membership_plan_${plan.slug}`}
                      disabled={checkoutMutation.isPending}
                      onClick={() => {
                        trackEvent("membership_cta_click", {
                          plan: plan.slug,
                          membership_tier: plan.slug,
                          value: plan.annualPrice + plan.setupFee,
                          currency: plan.currency,
                        });
                        setSelectedPlan(plan);
                      }}
                    >
                      {checkoutMutation.isPending
                        ? cs
                          ? "Připravujeme platbu…"
                          : "Preparing payment..."
                        : cs
                          ? `Zvolit ${plan.name}`
                          : `Join ${plan.nameEn?.trim() || plan.name}`}
                    </Button>
                  ) : (
                    <Button
                      variant="signal"
                      className="mt-2 w-full"
                      data-analytics-cta={`membership_plan_${plan.slug}`}
                      onClick={() => {
                        trackEvent("membership_cta_click", {
                          plan: plan.slug,
                          membership_tier: plan.slug,
                          value: plan.annualPrice + plan.setupFee,
                          currency: plan.currency,
                          destination: "register",
                        });
                        navigate({ to: "/register", search: { redirect: "/membership" } });
                      }}
                    >
                      {cs ? "Vytvořit účet a pokračovat" : "Create account to continue"}
                    </Button>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="membership-partners-title" className="bg-muted py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <div className="mb-8 max-w-2xl">
            <p className="eyebrow text-muted-foreground">
              {cs ? "CometX komunita" : "CometX community"}
            </p>
            <h2
              id="membership-partners-title"
              className="mt-2 font-display text-3xl font-extrabold sm:text-4xl"
            >
              {cs ? "Výhody partnerů" : "Partner benefits"}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {cs
                ? "Aktivní partnery zobrazujeme z údajů CometX. Nabídky a slevy uvádíme pouze tehdy, pokud jsou zveřejněné."
                : "Active partners are listed from CometX records. Offers and discounts appear only when they are published."}
            </p>
          </div>
          {partnersLoading && (
            <LoadingBlock label={cs ? "Načítáme partnery" : "Loading partners"} />
          )}
          {partnersError && <ErrorBlock error={partnersError} />}
          {!partnersLoading && !partnersError && partners.length === 0 && (
            <div className="rounded-3xl border border-border bg-muted p-8 text-sm text-muted-foreground">
              {cs
                ? "Aktivní partneři zatím nejsou zveřejněni."
                : "No active partners have been published yet."}
            </div>
          )}
          {partners.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {partners.map((partner) => (
                <article
                  key={partner.id}
                  className="flex min-h-44 flex-col rounded-2xl border border-border bg-background p-5 sm:p-6"
                >
                  <div className="flex items-center gap-4">
                    {partner.logo_url ? (
                      <img
                        src={partner.logo_url}
                        alt=""
                        className="size-14 rounded-xl border border-border bg-white object-contain p-2"
                        loading="lazy"
                      />
                    ) : (
                      <span
                        className="grid size-14 place-items-center rounded-xl bg-accent text-lg font-extrabold text-accent-foreground"
                        aria-hidden="true"
                      >
                        {partner.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-bold">{partner.name}</h3>
                      {partner.tier && (
                        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {partner.tier}
                        </p>
                      )}
                    </div>
                  </div>
                  {(cs ? partner.description : partner.description_en) || partner.description ? (
                    <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {!cs && partner.description_en?.trim()
                        ? partner.description_en
                        : partner.description}
                    </p>
                  ) : null}
                  {partner.website_url && (
                    <a
                      href={partner.website_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-2 text-sm font-semibold underline decoration-accent decoration-2 underline-offset-4"
                    >
                      {cs ? "Web partnera" : "Partner website"}
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="membership-faq-title" className="bg-background py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <div className="mb-5 max-w-3xl">
            <p className="eyebrow text-muted-foreground">
              {cs ? "Potřebujete vědět" : "Good to know"}
            </p>
            <h2 id="membership-faq-title" className="mt-2 font-display text-3xl font-extrabold">
              {cs ? "Časté otázky" : "Frequently asked questions"}
            </h2>
          </div>
          <div className="max-w-4xl divide-y divide-border border-y border-border">
            <details className="group py-5" open>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {cs ? "Jak dlouho členství platí?" : "How long does membership last?"}
                <ArrowDown className="size-4 shrink-0 transition group-open:rotate-180" />
              </summary>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {cs
                  ? "Plány se účtují ročně a automaticky se obnovují. Správu členství najdete ve svém účtu."
                  : "Plans are billed annually and renew automatically. You can manage your membership from your account."}
              </p>
            </details>
            <details className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {cs ? "Co přesně obsahuje vybraný plán?" : "What does each plan include?"}
                <ArrowDown className="size-4 shrink-0 transition group-open:rotate-180" />
              </summary>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {cs
                  ? "Aktuální výhody každého plánu jsou vypsané přímo u jeho ceny. Ceny vstupenek se zobrazí u konkrétní akce."
                  : "The current benefits are listed with each plan above. Ticket prices are shown on each event page."}
              </p>
            </details>
            <details className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {cs ? "Kde najdu své členství?" : "Where can I find my membership?"}
                <ArrowDown className="size-4 shrink-0 transition group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {cs
                  ? "Přehled a správu členství otevřete ve svém účtu."
                  : "Open your account to view and manage your membership."}{" "}
                <Link
                  to="/account/membership"
                  className="font-semibold underline underline-offset-4"
                >
                  {cs ? "Přejít na členství" : "Go to membership"}
                </Link>
              </p>
            </details>
          </div>
        </div>
      </section>

      <Dialog
        open={!!selectedPlan}
        onOpenChange={(open) => {
          if (!open) setSelectedPlan(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {cs ? "Doplňte údaje k členství" : "Complete your membership details"}
            </DialogTitle>
            <DialogDescription>
              {cs
                ? "Tyto informace jsou součástí registračního formuláře členství CometX."
                : "These details are part of the CometX membership registration form."}
            </DialogDescription>
          </DialogHeader>
          {selectedPlan && (
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (
                  !user?.email ||
                  !application.nationality ||
                  !application.motivation.trim() ||
                  !application.missingFromSubscription.trim()
                )
                  return;
                checkoutMutation.mutate({
                  planSlug: selectedPlan.slug,
                  email: user.email,
                  nationality: application.nationality as "slovak" | "czech" | "other",
                  motivation: application.motivation,
                  missingFromSubscription: application.missingFromSubscription,
                });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="membership-email">Email *</Label>
                <Input
                  id="membership-email"
                  type="email"
                  autoComplete="email"
                  required
                  readOnly
                  value={user?.email ?? ""}
                />
                <p className="text-xs text-muted-foreground">
                  {cs
                    ? "Členství bude přiřazeno k tomuto přihlášenému účtu. Pro jiný e-mail se nejprve přihlaste k odpovídajícímu účtu."
                    : "Membership is assigned to this signed-in account. To use another email, sign in to that account first."}
                </p>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">
                  {cs ? "Národnost" : "Nationality"} *
                </legend>
                {(["slovak", "czech", "other"] as const).map((value) => (
                  <label key={value} className="flex cursor-pointer items-center gap-3 text-sm">
                    <input
                      type="radio"
                      name="membership-nationality"
                      value={value}
                      required
                      checked={application.nationality === value}
                      onChange={() =>
                        setApplication((current) => ({ ...current, nationality: value }))
                      }
                    />
                    {value === "slovak"
                      ? cs
                        ? "Slovenská"
                        : "Slovak"
                      : value === "czech"
                        ? cs
                          ? "Česká"
                          : "Czech"
                        : cs
                          ? "Jiná"
                          : "Other"}
                  </label>
                ))}
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor="membership-motivation">
                  {cs
                    ? "Jaká je vaše motivace připojit se ke CometX prostřednictvím členství?"
                    : "What motivates you to join CometX through this membership?"}{" "}
                  *
                </Label>
                <textarea
                  id="membership-motivation"
                  required
                  maxLength={3000}
                  rows={4}
                  className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm"
                  value={application.motivation}
                  onChange={(event) =>
                    setApplication((current) => ({ ...current, motivation: event.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {cs
                    ? "Co vás přivedlo k členství a jak vás motivuje účast na akcích CometX?"
                    : "Tell us what prompted you to join and what motivates you to attend CometX events."}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="membership-feedback">
                  {cs ? "Co vám v našem členství chybí?" : "What is missing from our membership?"} *
                </Label>
                <textarea
                  id="membership-feedback"
                  required
                  maxLength={3000}
                  rows={4}
                  className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm"
                  value={application.missingFromSubscription}
                  onChange={(event) =>
                    setApplication((current) => ({
                      ...current,
                      missingFromSubscription: event.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {cs
                    ? "Co bychom mohli do budoucna přidat do našich služeb a členství, například nové typy akcí?"
                    : "What could we add to our services and membership, such as new types of events?"}
                </p>
              </div>

              <div className="rounded-xl border border-border p-4 text-sm">
                <p className="font-semibold">
                  {selectedPlan.name}:{" "}
                  {formatMoney(selectedPlan.annualPrice, selectedPlan.currency)} /{" "}
                  {cs ? "rok" : "year"}
                </p>
                {selectedPlan.setupFee > 0 && (
                  <p>
                    {cs ? "Vstupní poplatek" : "One-time setup fee"}:{" "}
                    {formatMoney(selectedPlan.setupFee, selectedPlan.currency)}
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  {cs
                    ? "Členství se každoročně obnovuje do zrušení. Další daně a poplatky se mohou připočítat v pokladně."
                    : "Membership renews annually until canceled. Additional taxes and fees may be added at checkout."}
                </p>
              </div>
              <Button
                type="submit"
                variant="signal"
                className="w-full"
                disabled={checkoutMutation.isPending}
              >
                {checkoutMutation.isPending
                  ? cs
                    ? "Připravujeme platbu…"
                    : "Preparing payment…"
                  : cs
                    ? "Pokračovat k platbě"
                    : "Continue to payment"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
