import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/podcast-video/$slug")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const slug = String(params.slug).replace(/\.mp4$/i, "").replace(/[^a-z0-9-]/gi, "");
        if (!slug) return new Response("Not found", { status: 404 });

        const inline = new URL(request.url).searchParams.has("inline");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Video files are large (hundreds of MB); redirect to a signed storage
        // URL so the CDN streams it with range support instead of buffering
        // the whole file in the worker. The link lives 24h so slow phone
        // downloads (and download managers that resume) don't expire midway.
        const { data, error } = await supabaseAdmin.storage
          .from("podcast")
          .createSignedUrl(`${slug}.mp4`, 60 * 60 * 24, inline ? undefined : { download: `${slug}.mp4` });
        if (error || !data?.signedUrl) return new Response("Not found", { status: 404 });

        return new Response(null, {
          status: 302,
          headers: {
            Location: data.signedUrl,
            "Cache-Control": "no-store",
          },
        });
      },

    },
  },
});
