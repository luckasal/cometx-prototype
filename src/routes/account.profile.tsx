import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getAccountOverview, updateMyProfile } from "@/lib/membership.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBlock, LoadingBlock } from "@/components/site/Bits";
import { useLanguage } from "@/contexts/LanguageContext";

export const Route = createFileRoute("/account/profile")({
  component: AccountProfilePage,
});

type FormState = {
  first_name: string;
  last_name: string;
  phone: string;
  company: string;
  job_title: string;
  country: string;
};

const empty: FormState = {
  first_name: "",
  last_name: "",
  phone: "",
  company: "",
  job_title: "",
  country: "",
};

function AccountProfilePage() {
  const { language } = useLanguage();
  const cs = language === "cs";
  const queryClient = useQueryClient();
  const fetchOverview = useServerFn(getAccountOverview);
  const saveProfile = useServerFn(updateMyProfile);
  const { data, isLoading, error } = useQuery({
    queryKey: ["account"],
    queryFn: () => fetchOverview(),
  });
  const [form, setForm] = useState<FormState>(empty);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        first_name: data.profile.firstName ?? "",
        last_name: data.profile.lastName ?? "",
        phone: data.profile.phone ?? "",
        company: data.profile.company ?? "",
        job_title: data.profile.jobTitle ?? "",
        country: data.profile.country ?? "",
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      saveProfile({
        data: Object.fromEntries(
          Object.entries(form).map(([key, value]) => [
            key,
            value.trim() === "" ? null : value.trim(),
          ]),
        ) as never,
      }),
    onSuccess: () => {
      toast.success(cs ? "Profil byl uložen" : "Profile saved");
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["account"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function field(key: keyof FormState) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        setSaved(false);
        setForm((prev) => ({ ...prev, [key]: e.target.value }));
      },
    };
  }

  return (
    <main className="bg-muted">
      <div className="mx-auto max-w-7xl px-5 pb-16 pt-10 lg:px-8 lg:pb-24 lg:pt-14">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-muted-foreground">{cs ? "Můj účet" : "My account"}</p>
            <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
              {cs ? "Chci být vidět" : "My public profile"}
            </h1>
          </div>
          <Link
            to="/account"
            className="text-sm font-semibold underline decoration-accent decoration-2 underline-offset-4"
          >
            {cs ? "Zpět na účet" : "Back to account"} →
          </Link>
        </div>
        <nav
          aria-label={cs ? "Sekce účtu" : "Account sections"}
          className="mb-7 flex flex-wrap gap-2"
        >
          <Link
            to="/account"
            className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold"
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
            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-ink-foreground"
            aria-current="page"
          >
            {cs ? "Moje údaje" : "My details"}
          </Link>
        </nav>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="rounded-3xl bg-card p-6 sm:p-9">
            {isLoading && <LoadingBlock label={cs ? "Načítáme profil" : "Loading profile"} />}
            {error && <ErrorBlock error={error} />}
            {saved && (
              <div
                role="status"
                className="mb-6 rounded-2xl border border-success/30 bg-success/10 p-4 text-sm"
              >
                <strong>{cs ? "Údaje uloženy." : "Details saved."}</strong>{" "}
                {cs
                  ? "Veřejné zobrazení vybraných údajů spravuje tým CometX."
                  : "The CometX team manages whether selected details are shown publicly."}
              </div>
            )}
            {data && (
              <form
                className="max-w-2xl space-y-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  mutation.mutate();
                }}
              >
                <div>
                  <h2 className="font-display text-xl font-extrabold">
                    {cs ? "Moje údaje" : "My details"}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {cs
                      ? "Upravte údaje ve svém účtu. E-mail je součástí přihlášení a nelze jej změnit zde."
                      : "Update the details on your account. Email is part of your login and cannot be changed here."}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">{cs ? "Jméno" : "First name"}</Label>
                    <Input id="first_name" autoComplete="given-name" {...field("first_name")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">{cs ? "Příjmení" : "Last name"}</Label>
                    <Input id="last_name" autoComplete="family-name" {...field("last_name")} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={data.profile.email ?? ""} disabled />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="company">{cs ? "Společnost" : "Company"}</Label>
                    <Input id="company" autoComplete="organization" {...field("company")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="job_title">{cs ? "Pozice" : "Job title"}</Label>
                    <Input
                      id="job_title"
                      autoComplete="organization-title"
                      {...field("job_title")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">{cs ? "Telefon" : "Phone"}</Label>
                    <Input id="phone" type="tel" autoComplete="tel" {...field("phone")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">{cs ? "Země" : "Country"}</Label>
                    <Input id="country" autoComplete="country-name" {...field("country")} />
                  </div>
                </div>
                <Button type="submit" variant="ink" size="lg" disabled={mutation.isPending}>
                  {mutation.isPending
                    ? cs
                      ? "Ukládáme…"
                      : "Saving..."
                    : cs
                      ? "Uložit profil"
                      : "Save profile"}
                </Button>
              </form>
            )}
          </section>
          <aside className="h-fit rounded-3xl border border-border bg-card p-6 sm:p-7">
            <p className="eyebrow text-muted-foreground">{cs ? "Náhled" : "Preview"}</p>
            <h2 className="mt-2 font-display text-xl font-extrabold">
              {cs ? "Vaše karta v komunitě" : "Your community profile card"}
            </h2>
            <div className="mt-5 rounded-2xl border border-border bg-muted p-5">
              <div className="grid size-12 place-items-center rounded-full bg-accent font-display text-lg font-extrabold text-accent-foreground">
                {(form.first_name || form.last_name || "?").trim().slice(0, 1).toLocaleUpperCase()}
              </div>
              <p className="mt-4 font-display text-xl font-bold">
                {[form.first_name, form.last_name].filter(Boolean).join(" ") ||
                  (cs ? "Jméno a příjmení" : "Your name")}
              </p>
              {(form.job_title || form.company) && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {[form.job_title, form.company].filter(Boolean).join(" · ")}
                </p>
              )}
              {form.country && <p className="mt-2 text-xs text-muted-foreground">{form.country}</p>}
            </div>
            <h3 className="mt-6 font-semibold">
              {cs ? "Soukromí a zveřejnění" : "Privacy and publication"}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {cs
                ? "Tento náhled sám o sobě profil nezveřejňuje. O zobrazení vybraných údajů rozhoduje tým CometX. E-mail a telefon se ve veřejném adresáři nezobrazují."
                : "This preview does not publish your profile. The CometX team controls whether selected details are shown publicly. Email and phone are not displayed in the public directory."}
            </p>
            <Link
              to="/community/members"
              className="mt-5 inline-flex text-sm font-bold underline decoration-accent decoration-2 underline-offset-4"
            >
              {cs ? "Zobrazit veřejný adresář" : "View the public directory"} →
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}
