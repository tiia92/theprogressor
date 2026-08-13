import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/article-image/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slug = String(params.slug).replace(/[^a-z0-9-]/gi, "");
        if (!slug) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage
          .from("article-images")
          .download(`${slug}.png`);
        if (error || !data) return new Response("Not found", { status: 404 });

        return new Response(await data.arrayBuffer(), {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
