import { createFileRoute } from "@tanstack/react-router";

/**
 * Public endpoint called weekly by pg_cron to publish the Insights report for
 * the week just ended. Authenticated with the publishable key.
 */
export const Route = createFileRoute("/api/public/hooks/generate-insights")({
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
          };
          const { generateInsightsReport } = await import("@/lib/generate-insights.server");
          const result = await generateInsightsReport(body ?? {});
          return Response.json({ ok: true, ...result });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[cron:generate-insights]", message);
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
