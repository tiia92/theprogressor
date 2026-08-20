import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Post feedback on an episode. AI-screened before it becomes public. */
export const submitPodcastComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string().min(1).max(200),
        body: z.string().trim().min(2).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { moderateComment } = await import("@/lib/podcast-comments.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: episode } = await supabase
      .from("podcast_episodes")
      .select("slug")
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (!episode) return { error: "That episode doesn't exist." };

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();

    let verdict;
    try {
      verdict = await moderateComment(data.body);
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Screening failed. Try again." };
    }

    const { error } = await supabaseAdmin.from("podcast_comments").insert({
      episode_slug: data.slug,
      user_id: userId,
      author_name: profile?.display_name?.trim() || "Listener",
      body: data.body,
      status: verdict.allowed ? "approved" : "rejected",
      ai_score: verdict.score,
      ai_reason: verdict.reason,
    });
    if (error) return { error: error.message };

    return verdict.allowed
      ? { ok: true as const }
      : { error: `That comment didn't pass screening: ${verdict.reason}` };
  });
