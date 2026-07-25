import { createFileRoute } from "@tanstack/react-router";

/**
 * Bulk-generate explainer articles from the current NewsAPI wire (up to 15).
 * Auth: anon key in `apikey` header.
 */
export const Route = createFileRoute("/api/public/hooks/generate-explainers")({
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
        let limit = 15;
        try {
          const body = (await request.json()) as { limit?: number } | null;
          if (body?.limit && Number.isFinite(body.limit)) limit = body.limit;
        } catch {
          // no body — fine
        }
        try {
          const { generateExplainersFromWire } = await import(
            "@/lib/generate-explainers.server"
          );
          const result = await generateExplainersFromWire(limit);
          return Response.json({ ok: true, ...result });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[hook:generate-explainers]", message);
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
