import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ADMIN_EMAIL = "discussabilityonline@gmail.com";

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
