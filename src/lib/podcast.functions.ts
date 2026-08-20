import { createServerFn } from "@tanstack/react-start";

/** Write and publish this week's episode. Admin-triggered or cron-triggered. */
export const triggerPodcastGeneration = createServerFn({ method: "POST" }).handler(async () => {
  const { generateWeeklyEpisode } = await import("@/lib/generate-podcast.server");
  return await generateWeeklyEpisode();
});
