import { createFileRoute } from "@tanstack/react-router";

/**
 * Weekly roundups of other outlets' pieces. Body: { kind: "analysis" | "opinion" }.
 * Analysis runs Saturday, opinion Sunday (via pg_cron). Auth: anon key in `apikey`.
 */
export const Route = createFileRoute("/api/public/hooks/generate-weekly-roundup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!expected || request.headers.get("apikey") !== expected) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }
        try {
          const body = (await request.json().catch(() => ({}))) as { kind?: string };
          const mod =
            body.kind === "opinion"
              ? await import("@/lib/generate-opinion.server")
              : await import("@/lib/generate-analysis.server");
          const result = await mod.generateWeeklyRoundup();
          return Response.json({ ok: true, kind: body.kind ?? "analysis", result });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[hook:generate-weekly-roundup]", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
