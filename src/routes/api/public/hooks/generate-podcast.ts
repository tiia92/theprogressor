import { createFileRoute } from "@tanstack/react-router";

/**
 * Public endpoint called by pg_cron each Sunday to write and publish the
 * weekly podcast episode. Authenticated with the publishable key.
 */
export const Route = createFileRoute("/api/public/hooks/generate-podcast")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        const expected = process.env['SUPABASE_PUBLISHABLE_KEY'];
        if (!expected || apiKey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        try {
          const body = (await request.json().catch(() => ({}))) as {
            weekStart?: string;
            weekEnd?: string;
            slugSuffix?: string;
            extraDirection?: string;
          };
          const { generateWeeklyEpisode } = await import("@/lib/generate-podcast.server");
          const result = await generateWeeklyEpisode(body ?? {});
          return Response.json({ ok: true, ...result });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[cron:generate-podcast]", message);
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
