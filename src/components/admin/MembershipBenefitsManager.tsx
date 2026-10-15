import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminCreateEntitlement,
  adminListEntitlements,
  adminListPlans,
  adminSetPlanEntitlement,
  adminUpdateEntitlementDefinition,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Field, inputClass, textareaClass } from "@/components/admin/AdminBits";

type BenefitDefinition = { key: string; name: string; description: string | null };
type PlanSummary = {
  id: string;
  name: string;
  slug: string;
  plan_entitlements?: Array<{
    value: number | null;
    entitlements: { key: string } | null;
  }>;
};

function benefitValueHint(key: string, slug: string) {
  if (["symposium_half_price", "other_events_discount", "potlach_discount"].includes(key))
    return "Discount percent";
  if (key === "workshop_credit")
    return slug === "cometxxl"
      ? "CHF credit · fixed at 100"
      : slug === "ambasador"
        ? "CHF credit · fixed at 300"
        : "Not supported for this plan";
  return "Included / access benefit · value 1";
}

export function MembershipBenefitsManager() {
  const queryClient = useQueryClient();
  const fetchPlans = useServerFn(adminListPlans);
  const fetchBenefits = useServerFn(adminListEntitlements);
  const updateDefinition = useServerFn(adminUpdateEntitlementDefinition);
  const createBenefit = useServerFn(adminCreateEntitlement);
  const setAssignment = useServerFn(adminSetPlanEntitlement);
  const plans = useQuery({ queryKey: ["admin", "plans"], queryFn: () => fetchPlans() });
  const benefits = useQuery({ queryKey: ["admin", "benefits"], queryFn: () => fetchBenefits() });
  const benefitRows = (benefits.data ?? []) as BenefitDefinition[];
  const planRows = (plans.data ?? []) as PlanSummary[];

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "plans"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "benefits"] });
    void queryClient.invalidateQueries({ queryKey: ["plans"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "event-benefit-matrix"] });
  };
  const run = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: () => {
      toast.success(
        "Membership benefit saved. This affects future checkouts; existing orders keep their recorded prices.",
      );
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="space-y-5 rounded-2xl border border-border/60 bg-card p-6">
      <div>
        <h2 className="font-display text-xl font-bold">Membership benefits</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Edit the benefit wording and decide which plans include it. Stable keys stay fixed because
          events and member content can rely on them. Changes apply to future checkouts and access
          checks; past orders are unchanged.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Percentages can be changed from 0–100. Workshop credits remain CHF 100 for CometXXL and
          CHF 300 for Ambasador to match the current checkout rules. New benefits grant access only;
          they do not create a new discount or free-ticket rule.
        </p>
      </div>

      {benefits.isError && (
        <p role="alert" className="text-sm text-destructive">
          Benefits could not be loaded. Try refreshing this section.
        </p>
      )}
      {plans.isError && (
        <p role="alert" className="text-sm text-destructive">
          Plans could not be loaded. Try refreshing this section.
        </p>
      )}
      {benefitRows.map((benefit) => (
        <div key={benefit.key} className="rounded-xl border border-border/60 p-4">
          <form
            className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              run.mutate(() =>
                updateDefinition({
                  data: {
                    key: benefit.key,
                    name: String(form.get("name") ?? ""),
                    description: String(form.get("description") ?? "").trim() || null,
                  },
                }),
              );
            }}
          >
            <Field label="Benefit name">
              <input
                name="name"
                defaultValue={benefit.name}
                required
                maxLength={160}
                className={inputClass}
              />
            </Field>
            <Field label="Description">
              <input
                name="description"
                defaultValue={benefit.description ?? ""}
                maxLength={1000}
                className={inputClass}
              />
            </Field>
            <div className="flex items-end">
              <Button type="submit" variant="outline" disabled={run.isPending}>
                Save wording
              </Button>
            </div>
          </form>
          <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
            Key: {benefit.key} · fixed
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {planRows.map((plan) => {
              const assignment = plan.plan_entitlements?.find(
                (entry) => entry.entitlements?.key === benefit.key,
              );
              const fixedWorkshop =
                benefit.key === "workshop_credit" && !["cometxxl", "ambasador"].includes(plan.slug);
              return (
                <form
                  key={plan.id}
                  className="rounded-lg bg-background/50 p-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    const enabled = form.get("enabled") === "on";
                    if (
                      assignment &&
                      !enabled &&
                      !window.confirm(
                        `Remove “${benefit.name}” from ${plan.name}? This changes future member prices or access.`,
                      )
                    ) {
                      const checkbox = event.currentTarget.elements.namedItem("enabled");
                      if (checkbox instanceof HTMLInputElement) checkbox.checked = true;
                      return;
                    }
                    const rawValue = String(form.get("value") ?? "").trim();
                    const value = rawValue === "" ? null : Number(rawValue);
                    if (rawValue !== "" && !Number.isFinite(value)) {
                      toast.error("Enter a valid benefit value.");
                      return;
                    }
                    if (
                      enabled === !!assignment &&
                      (!enabled || value === (assignment?.value ?? null))
                    ) {
                      toast.info("No membership benefit changes to save.");
                      return;
                    }
                    if (
                      !window.confirm(
                        `${enabled ? "Save this benefit assignment" : "Remove this benefit"} for ${plan.name}? This changes access or prices for future checkouts; existing orders are unchanged.`,
                      )
                    )
                      return;
                    run.mutate(() =>
                      setAssignment({
                        data: {
                          planId: plan.id,
                          entitlementKey: benefit.key,
                          enabled,
                          value,
                        },
                      }),
                    );
                  }}
                >
                  <label className="flex items-center gap-2 font-medium">
                    <input
                      name="enabled"
                      type="checkbox"
                      defaultChecked={!!assignment}
                      disabled={fixedWorkshop}
                    />
                    {plan.name}
                  </label>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      name="value"
                      type="number"
                      min={0}
                      max={
                        [
                          "symposium_half_price",
                          "other_events_discount",
                          "potlach_discount",
                        ].includes(benefit.key)
                          ? 100
                          : undefined
                      }
                      step="any"
                      aria-label={`${plan.name} benefit value`}
                      defaultValue={
                        assignment?.value ??
                        (benefit.key === "workshop_credit"
                          ? plan.slug === "cometxxl"
                            ? 100
                            : plan.slug === "ambasador"
                              ? 300
                              : ""
                          : 1)
                      }
                      disabled={fixedWorkshop}
                      readOnly={benefit.key === "workshop_credit"}
                      className={inputClass}
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={run.isPending || fixedWorkshop}
                    >
                      Save
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {benefitValueHint(benefit.key, plan.slug)}
                  </p>
                </form>
              );
            })}
          </div>
        </div>
      ))}

      <details className="rounded-xl border border-border/60 p-4">
        <summary className="cursor-pointer font-medium">Add an access benefit</summary>
        <p className="mt-2 text-xs text-muted-foreground">
          Use a stable lowercase key (for example, `partner_network`). New benefits can gate
          member-only tickets or content, but do not automatically discount tickets.
        </p>
        <form
          className="mt-4 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            run.mutate(() =>
              createBenefit({
                data: {
                  key: String(form.get("key") ?? "").trim(),
                  name: String(form.get("name") ?? "").trim(),
                  description: String(form.get("description") ?? "").trim() || null,
                },
              }),
            );
            event.currentTarget.reset();
          }}
        >
          <Field
            label="Stable key"
            hint="Lowercase letters, numbers and underscores; must start with a letter."
          >
            <input
              name="key"
              required
              minLength={2}
              maxLength={100}
              pattern="[a-z][a-z0-9_]*"
              className={inputClass}
            />
          </Field>
          <Field label="Name">
            <input name="name" required minLength={2} maxLength={160} className={inputClass} />
          </Field>
          <Field label="Description">
            <textarea name="description" maxLength={1000} className={textareaClass} />
          </Field>
          <div>
            <Button type="submit" variant="outline" disabled={run.isPending}>
              Create access benefit
            </Button>
          </div>
        </form>
      </details>
    </section>
  );
}
