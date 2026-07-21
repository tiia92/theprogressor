import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "";

interface Entry {
  path: string;
  changefreq?: "hourly" | "daily" | "weekly" | "monthly";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: Entry[] = [
          { path: "/", changefreq: "hourly", priority: "1.0" },
          { path: "/kind/news", changefreq: "daily", priority: "0.8" },
          { path: "/kind/analysis", changefreq: "daily", priority: "0.7" },
          { path: "/kind/explainer", changefreq: "weekly", priority: "0.8" },
          { path: "/kind/opinion", changefreq: "weekly", priority: "0.6" },
          { path: "/about", changefreq: "monthly", priority: "0.4" },
        ];

        // Include article slugs.
        try {
          const { createClient } = await import("@supabase/supabase-js");
          const url = process.env.SUPABASE_URL;
          const key = process.env.SUPABASE_PUBLISHABLE_KEY;
          if (url && key) {
            const supabase = createClient(url, key, {
              auth: { persistSession: false, autoRefreshToken: false },
            });
            const { data } = await supabase
              .from("articles")
              .select("slug, published_at")
              .order("published_at", { ascending: false })
              .limit(500);
            for (const row of data ?? []) {
              entries.push({ path: `/article/${row.slug}`, changefreq: "weekly", priority: "0.6" });
            }
          }
        } catch (e) {
          console.error("sitemap articles fetch failed", e);
        }

        const urls = entries
          .map((e) =>
            [
              `  <url>`,
              `    <loc>${BASE_URL}${e.path}</loc>`,
              e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
              e.priority ? `    <priority>${e.priority}</priority>` : null,
              `  </url>`,
            ]
              .filter(Boolean)
              .join("\n"),
          )
          .join("\n");

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
