import { createFileRoute } from "@tanstack/react-router";

/**
 * Generates bespoke artwork for the latest daily brief (the homepage lead)
 * if it doesn't have one yet. Auth: anon key in the `apikey` header.
 */
export const Route = createFileRoute("/api/public/hooks/generate-brief-image")({
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
          const { attachTodaysBriefImage } = await import("@/lib/article-image.server");
          const result = await attachTodaysBriefImage();
          return Response.json({ ok: true, ...result });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[hook:generate-brief-image]", message);
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
