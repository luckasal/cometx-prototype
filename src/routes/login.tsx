import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeReturnPath } from "@/lib/navigation";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Log in - CometX" },
      { name: "description", content: "Log in to your CometX account to manage events and membership." },
      { property: "og:title", content: "Log in to CometX" },
      { property: "og:description", content: "Access your CometX membership, tickets and member content." },
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back");
    window.location.href = safeReturnPath(redirect);
  }

  return (
    <div className="mx-auto grid max-w-md px-5 py-20 lg:py-28">
      <p className="eyebrow text-muted-foreground">Members</p>
      <h1 className="display-lg mt-3">Log in</h1>
      <form onSubmit={onSubmit} className="mt-10 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
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
          <Label htmlFor="password">Password</Label>
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
          {loading ? "Logging in..." : "Log in"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        No account yet?{" "}
        <Link
          to="/register"
          search={redirect ? { redirect } : {}}
          className="underline underline-offset-4"
        >
          Create one
        </Link>
        {" - or "}
        <button
          type="button"
          className="underline underline-offset-4"
          onClick={() => navigate({ to: "/membership" })}
        >
          see membership
        </button>
        .
      </p>
    </div>
  );
}
