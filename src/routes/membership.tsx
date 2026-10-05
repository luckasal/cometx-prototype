import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { getMembershipPlans, startMembershipCheckout } from "@/lib/membership.functions";
import { formatMoney } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock, PageHero, Section } from "@/components/site/Bits";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { trackEvent } from "@/lib/analytics";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

const englishBenefits: Record<string, string> = {
  member_content: "Talks, videos, interviews and articles in the members section",
  community_membership: "CometX community membership",
  symposium_half_price: "50% off the upcoming SCAS Symposium",
  symposium_free_ticket: "Free admission to the upcoming SCAS",
  other_events_discount: "50% off all other events except workshops",
  potlach_free_ticket: "Free admission to every Beer POTLA.CH",
  workshop_credit: "Credit for any CometX workshop",
};

function benefitLabel(benefit: { key: string; name: string; value: number | null }, cs: boolean) {
  const name = cs ? benefit.name : (englishBenefits[benefit.key] ?? benefit.name);
  if (benefit.key === "workshop_credit") return `${name}: CHF ${benefit.value}`;
  return name;
}

function MembershipPage() {
  useEffect(() => { trackEvent("membership_view"); }, []);
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
  const [application, setApplication] = useState({ email: "", nationality: "", motivation: "", missingFromSubscription: "" });

  useEffect(() => {
    if (user?.email) setApplication((current) => ({ ...current, email: current.email || user.email! }));
  }, [user?.email]);
  const fetchPlans = useServerFn(getMembershipPlans);
  const startCheckout = useServerFn(startMembershipCheckout);

  const { data, isLoading, error } = useQuery({
    queryKey: ["plans"],
    queryFn: () => fetchPlans(),
  });

  const checkoutMutation = useMutation({
    mutationFn: (input: { planSlug: string; email?: string; nationality?: "slovak" | "czech" | "other"; motivation?: string; missingFromSubscription?: string }) =>
      startCheckout({ data: input }),
    onSuccess: (result) => {
      if (result.url) window.location.href = result.url;
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <PageHero
        eyebrow={cs ? "Členství" : "Membership"}
        title={cs ? "Zažijte víc než jen naše akce" : "Experience more than our events"}
        lead={cs ? "Členství přímo podporuje rozvoj našich aktivit. Vyberte si ze tří kategorií přesně tu, která odpovídá vašim potřebám." : "Membership directly supports the growth of our activities. Choose the category that best matches your needs."}
      />

      <Section>
        {isLoading && <LoadingBlock label={cs ? "Načítáme členství" : "Loading plans"} />}
        {error && <ErrorBlock error={error} />}

        {data && (
          <div className="grid gap-6 lg:grid-cols-3">
            {data.map((plan, index) => (
              <div
                key={plan.slug}
                className={
                  index === 1
                    ? "flex flex-col rounded-3xl border-2 border-accent/50 bg-card p-8"
                    : "flex flex-col rounded-3xl border border-border/60 bg-card p-8"
                }
              >
                {index === 1 && <p className="eyebrow mb-3 text-accent-foreground">{cs ? "Nejčastější volba" : "Most chosen"}</p>}
                <h2 className="font-display text-3xl font-extrabold">{plan.name}</h2>
                <p className="mt-3 text-sm text-muted-foreground">{plan.description}</p>
                <p className="mt-6 font-display text-3xl font-extrabold">
                  {formatMoney(plan.annualPrice, plan.currency)}
                  <span className="text-sm font-normal text-muted-foreground"> {cs ? "/ rok" : "/ year"}</span>
                </p>
                {plan.billingInterval ? (
                  <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                    <p>{cs ? "Roční členství se automaticky obnovuje do zrušení." : "Renews annually until canceled."}</p>
                    {plan.setupFee > 0 && <p>{cs ? `Jednorázový vstupní poplatek: ${formatMoney(plan.setupFee, plan.currency)}.` : `One-time setup fee: ${formatMoney(plan.setupFee, plan.currency)}.`}</p>}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">{cs ? "Jednorázová platba na jeden rok. Bez automatického obnovení." : "One payment for one year. No automatic renewal."}</p>
                )}

                <ul className="mt-6 flex-1 space-y-3 border-t border-border pt-6">
                  {plan.benefits.map((benefit) => (
                    <li key={benefit.key} className="flex gap-3 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-accent-foreground" />
                      <span>{benefitLabel(benefit, cs)}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8">
                  {user ? (
                    <Button
                      variant={index === 1 ? "signal" : "outlineInk"}
                      className="w-full"
                      data-analytics-cta={`membership_plan_${plan.slug}`}
                      disabled={checkoutMutation.isPending}
                      onClick={() => {
                        trackEvent("membership_cta_click", { plan: plan.slug, membership_tier: plan.slug, value: plan.annualPrice + plan.setupFee, currency: plan.currency });
                        if (plan.billingInterval) {
                          setApplication((current) => ({ ...current, email: user.email ?? current.email }));
                          setSelectedPlan(plan);
                        } else {
                          checkoutMutation.mutate({ planSlug: plan.slug });
                        }
                      }}
                    >
                      {checkoutMutation.isPending ? (cs ? "Připravujeme platbu…" : "Preparing payment...") : (cs ? `Zvolit ${plan.name}` : `Join ${plan.name}`)}
                    </Button>
                  ) : (
                    <Button
                      variant={index === 1 ? "signal" : "outlineInk"}
                      className="w-full"
                      data-analytics-cta={`membership_plan_${plan.slug}`}
                      onClick={() => { trackEvent("membership_cta_click", { plan: plan.slug, membership_tier: plan.slug, value: plan.annualPrice + plan.setupFee, currency: plan.currency, destination: "register" }); navigate({ to: "/register", search: { redirect: "/membership" } }); }}
                    >
                      {cs ? "Pro členství si vytvořte účet" : "Create account to join"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-10 max-w-3xl border-t border-border pt-8">
          <h2 className="font-display text-xl font-bold">{cs ? "Každý člen vždy získá" : "Every member always receives"}</h2>
          <ul className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            {(cs ? [
              "Exkluzivní přístup do placené sekce webu",
              "Výhodné ceny vstupenek na akce CometX",
              "Informace o aktuálním dění z první ruky",
              "Možnost zviditelnit vlastní příběh a práci",
              "Dárky, vychytávky a komunitní zábavu",
              "Možnost odečíst podporu spolku z daní ve Švýcarsku",
            ] : [
              "Exclusive access to the members section",
              "Preferred prices for CometX events",
              "First-hand news and updates",
              "A chance to showcase your story and work",
              "Gifts, extras and community activities",
              "Potential Swiss tax deduction for association support",
            ]).map((item) => <li key={item} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" />{item}</li>)}
          </ul>
        </div>

        <p className="mt-8 max-w-2xl text-sm text-muted-foreground">
          {cs ? "Už jste členem?" : "Already a member?"}{" "}
          <Link to="/account/membership" className="underline underline-offset-4">
            {cs ? "Zobrazit členství" : "See your membership"}
          </Link>
          .
        </p>
      </Section>

      <Dialog open={!!selectedPlan} onOpenChange={(open) => { if (!open) setSelectedPlan(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{cs ? "Doplňte údaje k členství" : "Complete your membership details"}</DialogTitle>
            <DialogDescription>
              {cs ? "Tyto informace jsou součástí registračního formuláře členství CometX." : "These details are part of the CometX membership registration form."}
            </DialogDescription>
          </DialogHeader>
          {selectedPlan && (
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (!application.email || !application.nationality || !application.motivation.trim() || !application.missingFromSubscription.trim()) return;
                checkoutMutation.mutate({
                  planSlug: selectedPlan.slug,
                  email: application.email,
                  nationality: application.nationality as "slovak" | "czech" | "other",
                  motivation: application.motivation,
                  missingFromSubscription: application.missingFromSubscription,
                });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="membership-email">Email *</Label>
                <Input id="membership-email" type="email" autoComplete="email" required value={application.email} onChange={(event) => setApplication((current) => ({ ...current, email: event.target.value }))} />
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">{cs ? "Národnost" : "Nationality"} *</legend>
                {(["slovak", "czech", "other"] as const).map((value) => (
                  <label key={value} className="flex cursor-pointer items-center gap-3 text-sm">
                    <input type="radio" name="membership-nationality" value={value} required checked={application.nationality === value} onChange={() => setApplication((current) => ({ ...current, nationality: value }))} />
                    {value === "slovak" ? (cs ? "Slovenská" : "Slovak") : value === "czech" ? (cs ? "Česká" : "Czech") : (cs ? "Jiná" : "Other")}
                  </label>
                ))}
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor="membership-motivation">{cs ? "Jaká je vaše motivace připojit se ke CometX prostřednictvím členství?" : "What motivates you to join CometX through this membership?"} *</Label>
                <textarea id="membership-motivation" required maxLength={3000} rows={4} className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm" value={application.motivation} onChange={(event) => setApplication((current) => ({ ...current, motivation: event.target.value }))} />
                <p className="text-xs text-muted-foreground">{cs ? "Co vás přivedlo k členství a jak vás motivuje účast na akcích CometX?" : "Tell us what prompted you to join and what motivates you to attend CometX events."}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="membership-feedback">{cs ? "Co vám v našem členství chybí?" : "What is missing from our membership?"} *</Label>
                <textarea id="membership-feedback" required maxLength={3000} rows={4} className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm" value={application.missingFromSubscription} onChange={(event) => setApplication((current) => ({ ...current, missingFromSubscription: event.target.value }))} />
                <p className="text-xs text-muted-foreground">{cs ? "Co bychom mohli do budoucna přidat do našich služeb a členství, například nové typy akcí?" : "What could we add to our services and membership, such as new types of events?"}</p>
              </div>

              <div className="rounded-xl border border-border p-4 text-sm">
                <p className="font-semibold">{selectedPlan.name}: {formatMoney(selectedPlan.annualPrice, selectedPlan.currency)} / {cs ? "rok" : "year"}</p>
                {selectedPlan.setupFee > 0 && <p>{cs ? "Vstupní poplatek" : "One-time setup fee"}: {formatMoney(selectedPlan.setupFee, selectedPlan.currency)}</p>}
                <p className="mt-2 text-xs text-muted-foreground">
                  {cs ? "Členství se každoročně obnovuje do zrušení. Další daně a poplatky se mohou připočítat v pokladně." : "Membership renews annually until canceled. Additional taxes and fees may be added at checkout."}
                </p>
              </div>
              <Button type="submit" variant="signal" className="w-full" disabled={checkoutMutation.isPending}>
                {checkoutMutation.isPending ? (cs ? "Připravujeme platbu…" : "Preparing payment…") : (cs ? "Pokračovat k platbě" : "Continue to payment")}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
