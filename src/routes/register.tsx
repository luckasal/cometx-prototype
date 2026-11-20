import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeReturnPath } from "@/lib/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { trackEvent } from "@/lib/analytics";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/register")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Create an account - CometX" },
      {
        name: "description",
        content: "Create a free CometX account to register for events and join the community.",
      },
      { property: "og:title", content: "Create your CometX account" },
      {
        property: "og:description",
        content: "Register for events, manage your membership and read member content.",
      },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const { redirect } = Route.useSearch();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const { language } = useLanguage();
  const cs = language === "cs";

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error("Use at least 8 characters for your password.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}${safeReturnPath(redirect)}`,
        data: { first_name: form.firstName, last_name: form.lastName },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.user?.identities?.length) trackEvent("signup", { method: "email" });
    if (!data.session) {
      setConfirmationSent(true);
      return;
    }
    toast.success("Account created");
    window.location.href = safeReturnPath(redirect);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-16">
      <div className="grid overflow-hidden rounded-[2rem] border border-border/80 bg-background shadow-sm md:grid-cols-[0.85fr_1.15fr]">
        <aside className="flex flex-col justify-between bg-ink p-8 text-ink-foreground sm:p-10 lg:p-14">
          <div>
            <p className="eyebrow text-accent">CometX</p>
            <h2 className="mt-5 font-display text-3xl font-extrabold leading-tight sm:text-4xl">
              {cs ? "Začněte tady" : "Start here"}
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-foreground/70">
              {cs
                ? "Vytvořte si bezplatný účet pro vstupenky a správu členství."
                : "Create a free account for event tickets and membership management."}
            </p>
          </div>
          <Link
            to="/events"
            className="mt-10 inline-flex items-center gap-2 text-sm font-bold text-accent underline underline-offset-4"
          >
            {cs ? "Prohlédnout akce" : "Explore events"}
            <span aria-hidden="true">→</span>
          </Link>
        </aside>
        <section className="p-6 sm:p-10 lg:p-14">
          <p className="eyebrow text-muted-foreground">{cs ? "Přidejte se" : "Join"}</p>
          <h1 className="display-lg mt-3">{cs ? "Vytvořit účet" : "Create an account"}</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            {cs
              ? "Účet je zdarma. Členství je volitelné a můžete si ho přidat později."
              : "An account is free. Membership is optional and can be added afterwards."}
          </p>
          {confirmationSent ? (
            <p role="status" className="mt-8 rounded-lg border border-border p-5">
              {cs
                ? "Potvrďte účet v e-mailu. Poté budete přesměrováni zpět ke vstupenkám."
                : "Confirm your account in the email. You will then return to your tickets."}
            </p>
          ) : (
            <form onSubmit={onSubmit} className="mt-10 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{cs ? "Jméno" : "First name"}</Label>
                  <Input
                    id="firstName"
                    required
                    value={form.firstName}
                    onChange={set("firstName")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{cs ? "Příjmení" : "Last name"}</Label>
                  <Input id="lastName" required value={form.lastName} onChange={set("lastName")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={set("email")}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{cs ? "Heslo" : "Password"}</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={form.password}
                  onChange={set("password")}
                  autoComplete="new-password"
                />
              </div>
              <Button
                type="submit"
                variant="signal"
                size="lg"
                className="w-full"
                disabled={loading}
              >
                {loading
                  ? cs
                    ? "Vytvářím účet..."
                    : "Creating account..."
                  : cs
                    ? "Vytvořit účet"
                    : "Create account"}
              </Button>
            </form>
          )}
          <p className="mt-6 text-sm text-muted-foreground">
            {cs ? "Už máte účet?" : "Already have an account?"}{" "}
            <Link
              to="/login"
              search={redirect ? { redirect } : {}}
              className="underline underline-offset-4"
            >
              {cs ? "Přihlásit" : "Log in"}
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
