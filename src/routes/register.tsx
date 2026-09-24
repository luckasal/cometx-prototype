import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeReturnPath } from "@/lib/navigation";

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
        emailRedirectTo: `${window.location.origin}/account`,
        data: { first_name: form.firstName, last_name: form.lastName },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      setConfirmationSent(true);
      return;
    }
    toast.success("Account created");
    window.location.href = safeReturnPath(redirect);
  }

  return (
    <div className="mx-auto grid max-w-md px-5 py-20 lg:py-28">
      <p className="eyebrow text-muted-foreground">Join</p>
      <h1 className="display-lg mt-3">Create an account</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        An account is free. Membership is optional and can be added afterwards.
      </p>
      {confirmationSent ? <p role="status" className="mt-8 rounded-lg border border-border p-5">Check your email to confirm your account, then return to log in.</p> : <form onSubmit={onSubmit} className="mt-10 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" required value={form.firstName} onChange={set("firstName")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last name</Label>
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
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            value={form.password}
            onChange={set("password")}
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" variant="signal" size="lg" className="w-full" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>}
      <p className="mt-6 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" search={redirect ? { redirect } : {}} className="underline underline-offset-4">
          Log in
        </Link>
      </p>
    </div>
  );
}
