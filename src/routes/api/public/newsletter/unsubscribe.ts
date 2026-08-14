import { createFileRoute } from "@tanstack/react-router";

/** One-click unsubscribe link used in edition alert emails. */
export const Route = createFileRoute("/api/public/newsletter/unsubscribe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token") ?? "";
        const uuid = /^[0-9a-f-]{36}$/i.test(token);
        let ok = false;
        if (uuid) {
          try {
            const { unsubscribeByToken } = await import("@/lib/newsletter.server");
            ok = (await unsubscribeByToken(token)).ok;
          } catch (e) {
            console.error("[newsletter:unsubscribe]", e);
          }
        }
        const message = ok
          ? "You're unsubscribed. You won't get any more edition alerts."
          : "We couldn't find that subscription. It may already be removed.";
        return new Response(
          `<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribe — The Progressor</title><meta name="robots" content="noindex"></head>
<body style="margin:0;font:400 16px/1.6 Arial,sans-serif;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;">
<div style="max-width:440px;padding:24px;text-align:center;">
<p style="font:500 24px/1 Georgia,serif;color:#1d4ed8;margin:0 0 12px;">The Progressor</p>
<p>${message}</p>
<p><a href="/" style="color:#1d4ed8;">Back to the site</a></p>
</div></body></html>`,
          { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
        );
      },
    },
  },
});
