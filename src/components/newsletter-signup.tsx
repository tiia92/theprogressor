import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { subscribeToNewsletter } from "@/lib/newsletter.functions";

export function NewsletterSignup() {
  const subscribe = useServerFn(subscribeToNewsletter);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    try {
      await subscribe({ data: { email: email.trim() } });
      setEmail("");
      toast.success("You're on the list — alerts arrive with each new edition.");
    } catch {
      toast.error("Couldn't sign you up. Check the address and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm">
      <label
        htmlFor="newsletter-email"
        className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-primary-foreground"
      >
        <Mail className="h-3.5 w-3.5" />
        Daily edition alerts
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="newsletter-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="min-w-0 flex-1 rounded-md border border-primary-foreground/30 bg-primary-foreground/10 px-3 py-2 text-sm text-primary-foreground placeholder:text-primary-foreground/50 focus:border-primary-foreground focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-primary-foreground px-3 py-2 text-sm font-medium text-primary transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "…" : "Subscribe"}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-primary-foreground/60">
        One email per new edition. Unsubscribe anytime.
      </p>
    </form>
  );
}
