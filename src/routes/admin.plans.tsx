import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminListPlans, adminSavePlan } from "@/lib/admin.functions";
import { AdminPage, Field, inputClass, textareaClass } from "@/components/admin/AdminBits";
import { ErrorBlock, LoadingBlock } from "@/components/site/Bits";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/pricing";

export const Route = createFileRoute("/admin/plans")({
  component: AdminPlansPage,
});

type PlanForm = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  annual_price: string;
  active: boolean;
  sort_order: string;
};

const empty: PlanForm = {
  name: "",
  slug: "",
  description: "",
  annual_price: "0",
  active: true,
  sort_order: "0",
};

function AdminPlansPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PlanForm>(empty);

  const fetchPlans = useServerFn(adminListPlans);
  const savePlan = useServerFn(adminSavePlan);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "plans"],
    queryFn: () => fetchPlans(),
  });

  const save = useMutation({
    mutationFn: () =>
      savePlan({
        data: {
          ...(form.id ? { id: form.id } : {}),
          name: form.name.trim(),
          slug: form.slug.trim(),
          description: form.description.trim() === "" ? null : form.description.trim(),
          annual_price: Number(form.annual_price || 0),
          currency: "CHF",
          active: form.active,
          sort_order: Number(form.sort_order || 0),
        } as never,
      }),
    onSuccess: () => {
      toast.success("Plan saved");
      setForm(empty);
      queryClient.invalidateQueries({ queryKey: ["admin", "plans"] });
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function set<K extends keyof PlanForm>(key: K, value: PlanForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <AdminPage
      title="Membership plans"
      description="Prices and names are data. Entitlements attached to each plan drive all pricing logic."
    >
      {isLoading && <LoadingBlock label="Loading plans" />}
      {error && <ErrorBlock error={error} />}

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          {data?.map((plan) => (
            <div key={plan.id} className="border border-border bg-card p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-xl font-bold">{plan.name}</h2>
                  <p className="text-xs text-muted-foreground">/{plan.slug}</p>
                </div>
                <p className="font-display text-lg font-bold">
                  {formatMoney(Number(plan.annual_price), plan.currency)}
                </p>
              </div>
              {plan.description && (
                <p className="mt-3 text-sm text-muted-foreground">{plan.description}</p>
              )}
              <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
                {(plan.plan_entitlements ?? []).map((pe, i) => (
                  <li key={i}>
                    {pe.entitlements?.name}
                    {pe.value !== null ? `: ${pe.value}` : ""}
                  </li>
                ))}
              </ul>
              <button
                className="mt-4 text-xs underline underline-offset-4"
                onClick={() =>
                  setForm({
                    id: plan.id,
                    name: plan.name,
                    slug: plan.slug,
                    description: plan.description ?? "",
                    annual_price: String(Number(plan.annual_price)),
                    active: !!plan.active,
                    sort_order: String(plan.sort_order ?? 0),
                  })
                }
              >
                Edit plan
              </button>
            </div>
          ))}
        </div>

        <form
          className="space-y-5 border border-border bg-card p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.name.trim() || !form.slug.trim()) {
              toast.error("Name and slug are required.");
              return;
            }
            save.mutate();
          }}
        >
          <h2 className="font-display text-lg font-bold">{form.id ? "Edit plan" : "Add plan"}</h2>
          <Field label="Name">
            <input className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Slug">
            <input className={inputClass} value={form.slug} onChange={(e) => set("slug", e.target.value)} />
          </Field>
          <Field label="Description">
            <textarea
              className={textareaClass}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Annual price (CHF)">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.annual_price}
                onChange={(e) => set("annual_price", e.target.value)}
              />
            </Field>
            <Field label="Sort order">
              <input
                type="number"
                className={inputClass}
                value={form.sort_order}
                onChange={(e) => set("sort_order", e.target.value)}
              />
            </Field>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => set("active", e.target.checked)}
            />
            Active and purchasable
          </label>
          <div className="flex gap-3">
            <Button type="submit" variant="ink" disabled={save.isPending}>
              {save.isPending ? "Saving..." : "Save plan"}
            </Button>
            {form.id && (
              <Button type="button" variant="outlineInk" onClick={() => setForm(empty)}>
                New plan
              </Button>
            )}
          </div>
        </form>
      </div>
    </AdminPage>
  );
}
