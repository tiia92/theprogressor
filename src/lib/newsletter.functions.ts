import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Public newsletter signup — free weekly digest by default. */
export const subscribeToNewsletter = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ email: z.string().email().max(200) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { subscribeEmail } = await import("@/lib/newsletter.server");
    await subscribeEmail(data.email);
    return { ok: true };
  });

/** Reader's current digest settings. */
export const getDigestPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select("email, cadence, personalized, status")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      email: data?.email ?? null,
      cadence: (data?.cadence as string) ?? "weekly",
      personalized: Boolean(data?.personalized),
      subscribed: data?.status === "subscribed",
    };
  });

/** Update digest cadence/personalization. Daily + personalized require an active Pro plan. */
export const setDigestPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().email().max(200),
        cadence: z.enum(["weekly", "daily"]),
        personalized: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const environment = process.env['STRIPE_LIVE_API_KEY'] ? "live" : "sandbox";
    const { data: isPro } = await supabaseAdmin.rpc("has_active_subscription", {
      user_uuid: context.userId,
      check_env: environment,
    });

    const wantsPro = data.cadence === "daily" || data.personalized;
    if (wantsPro && !isPro) {
      return { ok: false as const, error: "A Pro membership is required for daily and personalized digests." };
    }

    const { subscribeEmail } = await import("@/lib/newsletter.server");
    await subscribeEmail(data.email, { userId: context.userId });

    const { error } = await supabaseAdmin
      .from("newsletter_subscribers")
      .update({ cadence: data.cadence, personalized: data.personalized })
      .eq("email", data.email.trim().toLowerCase());
    if (error) return { ok: false as const, error: error.message };

    return { ok: true as const };
  });
