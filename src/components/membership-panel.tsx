import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { getStripeEnvironment } from "@/lib/stripe";
import { getDigestPreferences, setDigestPreferences } from "@/lib/newsletter.functions";
import { createPortalSession } from "@/utils/payments.functions";

export function MembershipPanel() {
  const { user } = useAuth();
  const { isPro, subscription } = useSubscription();

  const fetchPrefs = useServerFn(getDigestPreferences);
  const savePrefs = useServerFn(setDigestPreferences);
  const openPortal = useServerFn(createPortalSession);

  const prefs = useQuery({ queryKey: ["digest-prefs"], queryFn: () => fetchPrefs({}) });

  const [email, setEmail] = useState("");
  const [cadence, setCadence] = useState<"weekly" | "daily">("weekly");
  const [personalized, setPersonalized] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!prefs.data) return;
    setEmail(prefs.data.email ?? user?.email ?? "");
    setCadence((prefs.data.cadence as "weekly" | "daily") ?? "weekly");
    setPersonalized(prefs.data.personalized);
  }, [prefs.data, user?.email]);

  async function onSave() {
    if (!email) {
      toast.error("Add an email address first.");
      return;
    }
    setSaving(true);
    try {
      const res = await savePrefs({ data: { email, cadence, personalized } });
      if (!res.ok) toast.error(res.error);
      else toast.success("Digest settings saved.");
    } catch {
      toast.error("Couldn't save your settings.");
    } finally {
      setSaving(false);
    }
  }

  async function onManage() {
    try {
      const res = await openPortal({
        data: { returnUrl: window.location.href, environment: getStripeEnvironment() },
      });
      if ("error" in res) throw new Error(res.error);
      window.open(res.url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open billing.");
    }
  }

  return (
    <section className="mt-8 space-y-10">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-foreground">Membership</h2>
        {isPro ? (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              You're a Pro member{subscription?.current_period_end
                ? ` — renews ${new Date(subscription.current_period_end).toLocaleDateString()}`
                : ""}
              {subscription?.cancel_at_period_end ? " and ends at the period end." : "."}
            </p>
            <Button className="mt-4" variant="outline" onClick={onManage}>
              Manage billing
            </Button>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              You're on the free plan: the weekly digest, unlimited saves and the full archive.
            </p>
            <Button asChild className="mt-4">
              <Link to="/pricing">Go Pro — $5/month</Link>
            </Button>
          </>
        )}
      </div>

      <div>
        <h2 className="font-serif text-2xl font-semibold text-foreground">Email digests</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Weekly is free. Daily and personalized digests are part of Pro.
        </p>

        <div className="mt-4 max-w-md space-y-4">
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            type="email"
          />

          <div className="flex gap-2">
            {(["weekly", "daily"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCadence(c)}
                disabled={c === "daily" && !isPro}
                className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors disabled:opacity-40 ${
                  cadence === c
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {c}
                {c === "daily" && !isPro ? " (Pro)" : ""}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={personalized}
              disabled={!isPro}
              onChange={(e) => setPersonalized(e.target.checked)}
            />
            Only send stories from topics I follow {isPro ? "" : "(Pro)"}
          </label>

          <Button onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : "Save digest settings"}
          </Button>
        </div>
      </div>
    </section>
  );
}
