import { createFileRoute } from "@tanstack/react-router";

/** Weekly free digest trigger (called by the scheduler). Requires the cron secret. */
export const Route = createFileRoute("/api/public/newsletter/weekly")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env['CRON_SECRET'];
        const provided =
          request.headers.get("x-cron-secret") ??
          new URL(request.url).searchParams.get("secret");
        if (!secret || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { sendWeeklyDigest } = await import("@/lib/newsletter.server");
        const result = await sendWeeklyDigest();
        return Response.json(result);
      },
    },
  },
});
