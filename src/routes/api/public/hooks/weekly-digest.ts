import { createFileRoute } from "@tanstack/react-router";

/**
 * Public endpoint called by pg_cron each Sunday to send the free weekly digest.
 * Authenticates with the project's publishable key in the `apikey` header.
 */
export const Route = createFileRoute("/api/public/hooks/weekly-digest")({
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
          const { sendWeeklyDigest } = await import("@/lib/newsletter.server");
          const result = await sendWeeklyDigest();
          return Response.json({ ok: true, ...result });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[cron:weekly-digest]", message);
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
