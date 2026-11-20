import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Log in - CometX" },
      {
        name: "description",
        content: "Log in to your CometX account to manage events and membership.",
      },
      { property: "og:title", content: "Log in to CometX" },
      {
        property: "og:description",
        content: "Access your CometX membership, tickets and member content.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { language } = useLanguage();
  const cs = language === "cs";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    trackEvent("login", { method: "password" });
    toast.success("Welcome back");
    await navigate({ to: safeReturnPath(redirect) as never });
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-16">
      <div className="grid overflow-hidden rounded-[2rem] border border-border/80 bg-background shadow-sm md:grid-cols-[0.85fr_1.15fr]">
        <aside className="flex flex-col justify-between bg-ink p-8 text-ink-foreground sm:p-10 lg:p-14">
          <div>
            <p className="eyebrow text-accent">CometX</p>
            <h2 className="mt-5 font-display text-3xl font-extrabold leading-tight sm:text-4xl">
              {cs ? "Vítejte zpět mezi svými" : "Welcome back to your community"}
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-foreground/70">
              {cs
                ? "Přihlaste se ke svému účtu a spravujte členství, vstupenky a profil."
                : "Sign in to manage your membership, tickets and profile."}
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
          <p className="eyebrow text-muted-foreground">{cs ? "Členové" : "Members"}</p>
          <h1 className="display-lg mt-3">{cs ? "Přihlášení" : "Log in"}</h1>
          <form onSubmit={onSubmit} className="mt-10 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{cs ? "Heslo" : "Password"}</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" variant="ink" size="lg" className="w-full" disabled={loading}>
              {loading ? (cs ? "Přihlašuji..." : "Logging in...") : cs ? "Přihlásit" : "Log in"}
            </Button>
          </form>
          <p className="mt-6 text-sm text-muted-foreground">
            {cs ? "Ještě nemáte účet?" : "No account yet?"}{" "}
            <Link
              to="/register"
              search={redirect ? { redirect } : {}}
              className="underline underline-offset-4"
            >
              {cs ? "Vytvořit účet" : "Create one"}
            </Link>
            {cs ? " – nebo " : " - or "}
            <button
              type="button"
              className="underline underline-offset-4"
              onClick={() => navigate({ to: "/membership" })}
            >
              {cs ? "prohlédnout členství" : "see membership"}
            </button>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
