import { createFileRoute } from "@tanstack/react-router";

/**
 * Reclassifies every article into the canonical topic taxonomy and writes
 * the slugs into `articles.tags`. Guarded by the project anon key.
 */
export const Route = createFileRoute("/api/public/hooks/backfill-topics")({
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
          const { backfillArticleTopics } = await import("@/lib/tag-articles.server");
          const result = await backfillArticleTopics();
          return Response.json({ ok: true, ...result });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[hook:backfill-topics]", message);
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
