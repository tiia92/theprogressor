import { useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { confirmAllowlistedEmail } from "@/lib/auth-bypass.functions";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in — The Progressor" },
      {
        name: "description",
        content:
          "Sign in to The Progressor to follow topics and keywords, save articles for later, and react to coverage.",
      },
      { property: "og:title", content: "Sign in — The Progressor" },
      {
        property: "og:description",
        content: "Follow topics, save stories, and react — your The Progressor reader account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const dest = search.redirect?.startsWith("/") ? search.redirect : "/dashboard";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          // Allowlisted addresses skip email confirmation and sign in immediately.
          const bypass = await confirmAllowlistedEmail({ data: { email } }).catch(() => null);
          if (bypass?.confirmed) {
            const { error: signInError } = await supabase.auth.signInWithPassword({
              email,
              password,
            });
            if (signInError) throw signInError;
          } else {
            toast.success("Check your email to confirm your account.");
            return;
          }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const unconfirmed = /confirm/i.test(error.message);
          const bypass = unconfirmed
            ? await confirmAllowlistedEmail({ data: { email } }).catch(() => null)
            : null;
          if (!bypass?.confirmed) throw error;
          const { error: retryError } = await supabase.auth.signInWithPassword({ email, password });
          if (retryError) throw retryError;
        }
      }
      navigate({ to: dest });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed. Try again.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: dest });
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Reader account
      </p>
      <h1 className="mt-2 font-heading text-4xl font-bold text-foreground">
        {mode === "signin" ? "Sign in" : "Create your account"}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Follow topics and keywords, save stories for later, and react to coverage.
      </p>

      <Button variant="outline" className="mt-8" onClick={onGoogle} type="button">
        Continue with Google
      </Button>

      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
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
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <button
        type="button"
        className="mt-6 text-sm text-muted-foreground underline hover:text-foreground"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
      >
        {mode === "signin"
          ? "New here? Create an account"
          : "Already have an account? Sign in"}
      </button>

      <Link to="/" className="mt-8 text-sm text-primary hover:underline">
        ← Back to today's edition
      </Link>
    </div>
  );
}
