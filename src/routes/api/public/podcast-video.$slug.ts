import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/podcast-video/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slug = String(params.slug).replace(/\.mp4$/i, "").replace(/[^a-z0-9-]/gi, "");
        if (!slug) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Video files are large (hundreds of MB); redirect to a signed storage
        // URL so the CDN streams it with range support instead of buffering
        // the whole file in the worker.
        const { data, error } = await supabaseAdmin.storage
          .from("podcast")
          .createSignedUrl(`${slug}.mp4`, 60 * 60, { download: `${slug}.mp4` });
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
