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

function benefitLabel(benefit: { key: string; name: string; value: number | null }) {
  if (benefit.value === null) return benefit.name;
  if (benefit.key.endsWith("_discount")) return `${benefit.name}: ${benefit.value}%`;
  if (benefit.key.endsWith("_credit")) return `${benefit.name}: CHF ${benefit.value}`;
  return benefit.name;
}

function MembershipPage() {
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
        eyebrow="Membership"
        title="Experience more than our events"
        lead="Membership directly supports CometX activities and gives you exclusive talks, articles and videos, better event prices, first-hand news and community benefits."
      />

      <Section>
        {isLoading && <LoadingBlock label="Loading plans" />}
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
                {index === 1 && <p className="eyebrow mb-3 text-accent-foreground">Most chosen</p>}
                <h2 className="font-display text-3xl font-extrabold">{plan.name}</h2>
                <p className="mt-3 text-sm text-muted-foreground">{plan.description}</p>
                <p className="mt-6 font-display text-3xl font-extrabold">
                  {formatMoney(plan.annualPrice, plan.currency)}
                  <span className="text-sm font-normal text-muted-foreground"> / year</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Prototype pricing — no payment collected</p>

                <ul className="mt-6 flex-1 space-y-3 border-t border-border pt-6">
                  {plan.benefits.map((benefit) => (
                    <li key={benefit.key} className="flex gap-3 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-accent-foreground" />
                      <span>{benefitLabel(benefit)}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8">
                  {user ? (
                    <Button
                      variant={index === 1 ? "signal" : "outlineInk"}
                      className="w-full"
                      disabled={checkoutMutation.isPending}
                      onClick={() => checkoutMutation.mutate(plan.slug)}
                    >
                      {checkoutMutation.isPending ? "Saving membership..." : `Join ${plan.name}`}
                    </Button>
                  ) : (
                    <Button
                      variant={index === 1 ? "signal" : "outlineInk"}
                      className="w-full"
                      onClick={() => navigate({ to: "/register", search: { redirect: "/membership" } })}
                    >
                      Create account to join
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-10 max-w-2xl text-sm text-muted-foreground">
          Choose a plan to save a prototype membership in your account. No payment is taken. Already a member?{" "}
          <Link to="/account/membership" className="underline underline-offset-4">
            See your membership
          </Link>
          .
        </p>
      </Section>
    </>
  );
}
