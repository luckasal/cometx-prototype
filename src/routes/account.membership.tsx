import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { getAccountOverview } from "@/lib/membership.functions";
import { Button } from "@/components/ui/button";
import {
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  Section,
  SectionHeading,
  StatusPill,
} from "@/components/site/Bits";

export const Route = createFileRoute("/account/membership")({
  validateSearch: z.object({ checkout: z.enum(["success", "cancelled"]).optional() }),
  component: AccountMembershipPage,
});

function benefitLabel(b: { key: string; name: string; value: number | null }) {
  if (b.value === null) return b.name;
  if (b.key.endsWith("_discount")) return `${b.name}: ${b.value}%`;
  if (b.key.endsWith("_credit")) return `${b.name}: CHF ${b.value}`;
  return b.name;
}

function AccountMembershipPage() {
  const { checkout } = Route.useSearch();
  const fetchOverview = useServerFn(getAccountOverview);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["account"],
    queryFn: () => fetchOverview(),
  });

  useEffect(() => {
    if (checkout === "success") {
      toast.success("Payment received. Your membership activates as soon as Stripe confirms it.");
      const timer = setTimeout(() => refetch(), 2500);
      return () => clearTimeout(timer);
    }
    if (checkout === "cancelled") toast("Checkout cancelled - nothing was charged.");
    return undefined;
  }, [checkout, refetch]);

  return (
    <Section>
      <SectionHeading eyebrow="Membership" title="Your membership" />
      {isLoading && <LoadingBlock label="Loading membership" />}
      {error && <ErrorBlock error={error} />}

      {data && !data.membership && (
        <div className="max-w-xl">
          <EmptyBlock
            title="No active membership"
            hint="Pick a tier and pay with a Stripe test card to see the full member experience."
          />
          <Button asChild variant="signal" size="lg" className="mt-6">
            <Link to="/membership">See the plans</Link>
          </Button>
        </div>
      )}

      {data?.membership && (
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="border border-ink">
            <div className="bg-ink px-6 py-5 text-ink-foreground">
              <p className="eyebrow text-accent">Current plan</p>
              <p className="mt-1 font-display text-2xl font-extrabold">{data.membership.planName}</p>
            </div>
            <div className="space-y-4 p-6">
              <StatusPill tone="success">{data.membership.status}</StatusPill>
              {data.membership.endsAt && (
                <p className="text-sm text-muted-foreground">
                  Valid until{" "}
                  {new Date(data.membership.endsAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
              <Button asChild variant="outlineInk" className="w-full">
                <Link to="/membership">Change plan</Link>
              </Button>
            </div>
          </div>

          <div>
            <h3 className="font-display text-lg font-bold">What is included</h3>
            <ul className="mt-5 divide-y divide-border border-y border-border">
              {data.membership.benefits.map((benefit) => (
                <li key={benefit.key} className="py-4 text-sm">
                  {benefitLabel(benefit)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Section>
  );
}
