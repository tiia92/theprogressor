import { createFileRoute } from "@tanstack/react-router";

const BASE_URL = "https://theprogressor.lovable.app";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const KIND_TYPES: Record<string, string[]> = {
  news: ["daily_brief", "morning_headlines", "evening_recap", "news", "timeline"],
  analysis: ["analysis", "weekly_roundup"],
  explainer: ["deep_dive", "explainer"],
  opinion: ["opinion"],
};

export const Route = createFileRoute("/rss.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { createPublicSupabaseClient } = await import("@/lib/supabase-public.server");
        const url = new URL(request.url);
        const topic = url.searchParams.get("topic");
        const kind = url.searchParams.get("kind");

        const supabase = createPublicSupabaseClient();
        let q = supabase
          .from("articles")
          .select("slug, title, dek, category, tags, article_type, hero_image_url, published_at")
          .order("published_at", { ascending: false })
          .limit(50);
        if (topic) q = q.contains("tags", [topic]);
        if (kind && KIND_TYPES[kind]) q = q.in("article_type", KIND_TYPES[kind]);

        const { data } = await q;

        const title = topic
          ? `The Progressor — ${topic}`
          : kind
            ? `The Progressor — ${kind}`
            : "The Progressor";
        const selfUrl = `${BASE_URL}/rss.xml${url.search}`;

        const items = (data ?? [])
          .map((a) => {
            const link = `${BASE_URL}/article/${a.slug}`;
            return `    <item>
      <title>${esc(a.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${new Date(a.published_at).toUTCString()}</pubDate>
      <category>${esc(a.category ?? "")}</category>
      <description>${esc(a.dek ?? "")}</description>${
        a.hero_image_url
          ? `\n      <enclosure url="${esc(a.hero_image_url)}" type="image/jpeg" length="0" />`
          : ""
      }
    </item>`;
          })
          .join("\n");

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(title)}</title>
    <link>${BASE_URL}</link>
    <atom:link href="${esc(selfUrl)}" rel="self" type="application/rss+xml" />
    <language>en-us</language>
    <description>Daily briefs, headlines, analysis, and explainers on U.S. politics — written by an AI editor with a progressive lens.</description>
${items}
  </channel>
</rss>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control": "public, max-age=1800",
          },
        });
      },
    },
  },
});
