import { createFileRoute } from "@tanstack/react-router";

/**
 * Publishes the daily Analysis package: an "Analysis Briefing" listicle
 * aggregated from real analysis pieces via NewsAPI, plus 1–3 AI-authored
 * analysis articles.
 *
 * Auth: anon key in `apikey` header (the `/api/public/*` prefix bypasses
 * published-site auth).
 */
export const Route = createFileRoute("/api/public/hooks/generate-analysis")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!expected || apiKey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        try {
          const url = new URL(request.url);
          const columnsParam = url.searchParams.get("columns");
          const columns = columnsParam ? Number.parseInt(columnsParam, 10) : undefined;
          const { generateAnalysisEdition } = await import(
            "@/lib/generate-analysis.server"
          );
          const result = await generateAnalysisEdition({
            columns: Number.isFinite(columns) ? columns : undefined,
          });
          return Response.json({ ok: true, ...result });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[hook:generate-analysis]", message);
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
