import { createFileRoute } from "@tanstack/react-router";

/**
 * Publishes the daily Opinion pair: a "Voices Today" listicle aggregated from
 * real op-eds via NewsAPI, plus one AI-authored opinion column.
 *
 * Auth: anon key in `apikey` header (the `/api/public/*` prefix bypasses
 * published-site auth).
 */
export const Route = createFileRoute("/api/public/hooks/generate-opinion")({
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
          const { generateOpinionEdition } = await import(
            "@/lib/generate-opinion.server"
          );
          const result = await generateOpinionEdition();
          return Response.json({ ok: true, ...result });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[hook:generate-opinion]", message);
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
