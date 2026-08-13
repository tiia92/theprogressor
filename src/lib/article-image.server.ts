// Server-only: generates a bespoke illustration for a single article and
// stores it in the private `article-images` bucket. Served back to readers
// through /api/public/article-image/$slug.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const IMAGE_URL = "https://ai.gateway.lovable.dev/v1/images/generations";
const BUCKET = "article-images";

const STYLE =
  "Flat vector editorial illustration, animated cartoon style. No realistic human faces, no photorealism, no text or lettering. " +
  "Deep blue and cobalt palette with warm gold accents, clean white background, bold simple geometric shapes, subtle paper grain, modern newspaper illustration.";

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Generate + store artwork for one article. Returns the public path to use as
 * hero_image_url, or null if generation failed (never throws — artwork is
 * decorative and must not break an edition run).
 */
export async function generateArticleImage(opts: {
  slug: string;
  title: string;
  dek?: string | null;
  category?: string | null;
}): Promise<string | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;

  const prompt = `${STYLE}\n\nDepict, symbolically and abstractly, the subject of this news story about U.S. ${
    opts.category ?? "politics"
  }: "${opts.title}". ${opts.dek ?? ""}`.trim();

  try {
    const resp = await fetch(IMAGE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-image-2",
        prompt,
        size: "1536x1024",
        quality: "low",
        n: 1,
      }),
    });
    if (!resp.ok) {
      console.error("[article-image] gateway", resp.status, await resp.text());
      return null;
    }
    const json = (await resp.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) return null;

    const path = `${opts.slug}.png`;
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, b64ToBytes(b64), { contentType: "image/png", upsert: true });
    if (error) {
      console.error("[article-image] upload", error.message);
      return null;
    }
    return `/api/public/article-image/${opts.slug}`;
  } catch (e) {
    console.error("[article-image] failed", e);
    return null;
  }
}

/** Generate artwork for an article row and persist hero_image_url. */
export async function attachArticleImage(slug: string) {
  const { data: row } = await supabaseAdmin
    .from("articles")
    .select("slug, title, dek, category, hero_image_url")
    .eq("slug", slug)
    .maybeSingle();
  if (!row) return null;
  if (row.hero_image_url) return row.hero_image_url;

  const url = await generateArticleImage(row);
  if (!url) return null;
  await supabaseAdmin.from("articles").update({ hero_image_url: url }).eq("slug", slug);
  return url;
}

/** Artwork for the most recent featured daily brief (the homepage lead). */
export async function attachTodaysBriefImage() {
  const { data: rows } = await supabaseAdmin
    .from("articles")
    .select("slug, hero_image_url")
    .eq("article_type", "daily_brief")
    .order("published_at", { ascending: false })
    .limit(1);
  const brief = rows?.[0];
  if (!brief) return { slug: null, url: null };
  const url = await attachArticleImage(brief.slug);
  return { slug: brief.slug, url };
}
