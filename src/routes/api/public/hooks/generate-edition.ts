import { createFileRoute } from "@tanstack/react-router";

/**
 * Public endpoint called by pg_cron to autonomously publish today's edition.
 * Fires the same generation path the "Generate today's edition" button uses.
 *
 * Auth: the `/api/public/*` prefix bypasses Lovable's published-site auth. The
 * cron job authenticates with the project's anon key in the `apikey` header,
 * which we verify here.
 */
export const Route = createFileRoute("/api/public/hooks/generate-edition")({
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
          const { generateTodaysEdition } = await import("@/lib/generate-edition.server");
          const result = await generateTodaysEdition();
          return Response.json({ ok: true, ...result });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[cron:generate-edition]", message);
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
