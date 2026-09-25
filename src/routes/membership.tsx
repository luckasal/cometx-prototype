import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { getMembershipPlans, selectPrototypeMembership } from "@/lib/membership.functions";
import { formatMoney } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock, PageHero, Section } from "@/components/site/Bits";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { trackEvent } from "@/lib/analytics";

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
  const { language } = useLanguage();
  const cs = language === "cs";
  const { user } = useAuth();
  const navigate = useNavigate();
  const fetchPlans = useServerFn(getMembershipPlans);
  const startCheckout = useServerFn(selectPrototypeMembership);

  const { data, isLoading, error } = useQuery({
    queryKey: ["plans"],
    queryFn: () => fetchPlans(),
  });

  const checkoutMutation = useMutation({
    mutationFn: (planSlug: string) =>
      startCheckout({ data: { planSlug } }),
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
                    ? "flex flex-col border-2 border-ink bg-card p-8"
                    : "flex flex-col border border-border bg-card p-8"
                }
              >
                {index === 1 && <p className="eyebrow mb-3 text-accent-foreground">{cs ? "Nejčastější volba" : "Most chosen"}</p>}
                <h2 className="font-display text-3xl font-extrabold">{plan.name}</h2>
                <p className="mt-3 text-sm text-muted-foreground">{plan.description}</p>
                <p className="mt-6 font-display text-3xl font-extrabold">
                  {formatMoney(plan.annualPrice, plan.currency)}
                  <span className="text-sm font-normal text-muted-foreground"> {cs ? "/ rok" : "/ year"}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{cs ? "Online platba bude brzy dostupná." : "Online checkout will be available soon."}</p>

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
                      disabled={checkoutMutation.isPending}
                      onClick={() => { trackEvent("membership_cta", { plan: plan.slug }); checkoutMutation.mutate(plan.slug); }}
                    >
                      {checkoutMutation.isPending ? (cs ? "Ukládáme členství…" : "Saving membership...") : (cs ? `Zvolit ${plan.name}` : `Join ${plan.name}`)}
                    </Button>
                  ) : (
                    <Button
                      variant={index === 1 ? "signal" : "outlineInk"}
                      className="w-full"
                      onClick={() => { trackEvent("membership_cta", { plan: plan.slug, destination: "register" }); navigate({ to: "/register", search: { redirect: "/membership" } }); }}
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
          {cs ? "Členství a online platbu dokončíte, jakmile bude checkout aktivní. Už jste členem?" : "Membership checkout will be available once payments are enabled. Already a member?"}{" "}
          <Link to="/account/membership" className="underline underline-offset-4">
            {cs ? "Zobrazit členství" : "See your membership"}
          </Link>
          .
        </p>
      </Section>
    </>
  );
}
