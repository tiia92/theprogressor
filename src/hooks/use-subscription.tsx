import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { useAuth } from "@/hooks/use-auth";

export interface SubscriptionRow {
  status: string;
  price_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
}

function computeActive(sub: SubscriptionRow | null) {
  if (!sub) return false;
  const future = !sub.current_period_end || new Date(sub.current_period_end) > new Date();
  if (["active", "trialing", "past_due"].includes(sub.status)) return future;
  if (sub.status === "canceled") return future;
  return false;
}

/** Reader's Pro entitlement. Client-side UX only — always re-check server-side. */
export function useSubscription() {
  const { user, loading: authLoading } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    let environment: "sandbox" | "live";
    try {
      environment = getStripeEnvironment();
    } catch {
      setSubscription(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("subscriptions")
      .select("status, price_id, current_period_end, cancel_at_period_end")
      .eq("user_id", user.id)
      .eq("environment", environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSubscription((data as SubscriptionRow | null) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void refetch();
  }, [authLoading, refetch]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`subscriptions:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        () => void refetch(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, refetch]);

  return {
    subscription,
    isPro: computeActive(subscription),
    loading: loading || authLoading,
    refetch,
  };
}
