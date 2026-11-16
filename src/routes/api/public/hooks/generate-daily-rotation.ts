import { createFileRoute } from "@tanstack/react-router";

/**
 * Publishes the one non-news article for the day (analysis, explainer, or
 * opinion), cycling daily. Paired with the daily brief from generate-edition.
 * Auth: anon key in `apikey` header.
 */
export const Route = createFileRoute("/api/public/hooks/generate-daily-rotation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!expected || request.headers.get("apikey") !== expected) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }
        try {
          const { rotationKindFor } = await import("@/lib/daily-rotation");
          const kind = rotationKindFor(new Date().toISOString().slice(0, 10));
          let result: unknown;
          if (kind === "analysis") {
            const { generateAnalysisEdition } = await import("@/lib/generate-analysis.server");
            result = await generateAnalysisEdition({ columns: 1, skipBriefing: true });
          } else if (kind === "opinion") {
            const { generateOpinionEdition } = await import("@/lib/generate-opinion.server");
            result = await generateOpinionEdition({ skipBriefing: true });
          } else {
            const { generateExplainersFromWire } = await import("@/lib/generate-explainers.server");
            result = await generateExplainersFromWire(1);
          }
          return Response.json({ ok: true, kind, result });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[hook:generate-daily-rotation]", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
