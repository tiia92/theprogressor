import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/podcast-audio/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slug = String(params.slug).replace(/[^a-z0-9-]/gi, "");
        if (!slug) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage
          .from("podcast")
          .download(`${slug}.mp3`);
        if (error || !data) return new Response("Not found", { status: 404 });

        const bytes = await data.arrayBuffer();
        return new Response(bytes, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Content-Length": String(bytes.byteLength),
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
