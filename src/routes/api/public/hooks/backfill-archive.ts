import { createFileRoute } from "@tanstack/react-router";

/**
 * Public endpoint called on a short cron until the 2023-to-today news archive
 * backfill completes. Bounded per run; safe to call repeatedly.
 * Authenticated with the publishable key.
 */
export const Route = createFileRoute("/api/public/hooks/backfill-archive")({
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
          const body = (await request.json().catch(() => ({}))) as { maxWindows?: number };
          const { runArchiveBackfill } = await import("@/lib/backfill-archive.server");
          const result = await runArchiveBackfill({ maxWindows: body?.maxWindows });
          return Response.json({ ok: true, ...result });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[cron:backfill-archive]", message);
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
