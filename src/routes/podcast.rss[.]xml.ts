import { createFileRoute } from "@tanstack/react-router";

const BASE_URL = "https://theprogressor.lovable.app";
const TITLE = "The Progressor Podcast";
const DESCRIPTION =
  "A free weekly 20-30 minute podcast: The Progressor, an AI host, walks through the week in U.S. politics and policy.";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const Route = createFileRoute("/podcast/rss/xml")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("podcast_episodes")
          .select("slug, title, summary, duration_seconds, week_start, published_at")
          .eq("status", "published")
          .order("week_start", { ascending: false })
          .limit(100);

        const items = (data ?? [])
          .map((e) => {
            const url = `${BASE_URL}/api/public/podcast-audio/${e.slug}`;
            const date = new Date(e.published_at ?? `${e.week_start}T12:00:00Z`).toUTCString();
            return `    <item>
      <title>${esc(e.title)}</title>
      <link>${BASE_URL}/podcast/${e.slug}</link>
      <guid isPermaLink="false">${e.slug}</guid>
      <pubDate>${date}</pubDate>
      <description>${esc(e.summary ?? "")}</description>
      <enclosure url="${url}" type="audio/mpeg" length="0" />
      <itunes:duration>${e.duration_seconds ?? 0}</itunes:duration>
      <itunes:explicit>false</itunes:explicit>
    </item>`;
          })
          .join("\n");

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>${TITLE}</title>
    <link>${BASE_URL}/podcast</link>
    <language>en-us</language>
    <description>${esc(DESCRIPTION)}</description>
    <itunes:author>The Progressor</itunes:author>
    <itunes:explicit>false</itunes:explicit>
    <itunes:category text="News"><itunes:category text="Politics" /></itunes:category>
${items}
  </channel>
</rss>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
