import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ADMIN_EMAIL = "discussabilityonline@gmail.com";

export interface LatestEpisodeRow {
  slug: string;
  title: string;
  summary: string;
  duration_seconds: number | null;
  week_start: string;
}

/** Fetch the most recently published podcast episode. Public. */
export const getLatestPodcastEpisode = createServerFn({ method: "GET" }).handler(async () => {
  const { createPublicSupabaseClient } = await import("@/lib/supabase-public.server");
  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase
    .from("podcast_episodes")
    .select("slug, title, summary, duration_seconds, week_start")
    .eq("status", "published")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as LatestEpisodeRow | null;
});

/** Write and publish an episode. Admin only. */
export const triggerPodcastGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        weekEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
      .optional()
      .parse(d ?? undefined),
  )
  .handler(async ({ data, context }) => {
    const email = (context.claims as { email?: string }).email;
    if (email !== ADMIN_EMAIL) {
      return { error: "Only the editor can generate episodes." as const };
    }
    const { generateWeeklyEpisode } = await import("@/lib/generate-podcast.server");
    return await generateWeeklyEpisode({
      weekStart: data?.weekStart,
      weekEnd: data?.weekEnd,
    });
  });
