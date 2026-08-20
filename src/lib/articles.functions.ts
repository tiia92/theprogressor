import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function serverPublicClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const listArticles = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        type: z.string().optional(),
        category: z.string().optional(),
        kind: z.enum(["news", "analysis", "explainer", "opinion"]).optional(),
        limit: z.number().int().min(1).max(100).default(30),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const supabase = serverPublicClient();
    let q = supabase
      .from("articles")
      .select("id, slug, title, dek, article_type, category, tags, hero_gradient, featured, upvotes, published_at")
      .order("published_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(data.limit);

    if (data.type) q = q.eq("article_type", data.type);
    if (data.category) q = q.eq("category", data.category);

    // "kind" is a client-side grouping — translate to a set of article_types.
    if (data.kind) {
      const map: Record<string, string[]> = {
        news: ["daily_brief", "morning_headlines", "evening_recap", "news", "timeline"],
        analysis: ["analysis", "weekly_roundup"],
        explainer: ["deep_dive", "explainer"],
        opinion: ["opinion"],
      };
      q = q.in("article_type", map[data.kind]);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listArticlesByTopic = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        topic: z.string().min(1),
        limit: z.number().int().min(1).max(100).default(60),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const supabase = serverPublicClient();
    const { data: rows, error } = await supabase
      .from("articles")
      .select("id, slug, title, dek, article_type, category, tags, hero_gradient, featured, upvotes, published_at")
      .contains("tags", [data.topic])
      .order("published_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listRelatedArticles = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        slug: z.string().min(1),
        category: z.string().optional(),
        tags: z.array(z.string()).default([]),
        limit: z.number().int().min(1).max(12).default(4),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const supabase = serverPublicClient();
    const cols =
      "id, slug, title, dek, article_type, category, tags, hero_gradient, hero_image_url, featured, upvotes, published_at";

    const picked: Record<string, unknown>[] = [];
    const seen = new Set<string>([data.slug]);

    if (data.tags.length > 0) {
      const { data: byTag } = await supabase
        .from("articles")
        .select(cols)
        .overlaps("tags", data.tags)
        .order("published_at", { ascending: false })
        .limit(data.limit + 5);
      for (const r of byTag ?? []) {
        if (seen.has(r.slug)) continue;
        seen.add(r.slug);
        picked.push(r);
      }
    }

    if (picked.length < data.limit && data.category) {
      const { data: byCat } = await supabase
        .from("articles")
        .select(cols)
        .eq("category", data.category)
        .order("published_at", { ascending: false })
        .limit(data.limit + 5);
      for (const r of byCat ?? []) {
        if (seen.has(r.slug)) continue;
        seen.add(r.slug);
        picked.push(r);
      }
    }

    if (picked.length < data.limit) {
      const { data: recent } = await supabase
        .from("articles")
        .select(cols)
        .order("published_at", { ascending: false })
        .limit(data.limit + 5);
      for (const r of recent ?? []) {
        if (seen.has(r.slug)) continue;
        seen.add(r.slug);
        picked.push(r);
      }
    }

    return picked.slice(0, data.limit);
  });

export const ARTICLE_COLUMNS =
  "id, slug, title, dek, body, article_type, category, tags, sources, hero_gradient, hero_image_url, featured, views, upvotes, published_at";

export const getArticleBySlug = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ slug: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const supabase = serverPublicClient();
    const { data: row, error } = await supabase
      .from("articles")
      .select(ARTICLE_COLUMNS)
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const getHomepage = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = serverPublicClient();
  const { data: rows, error } = await supabase
    .from("articles")
    .select(
      "id, slug, title, dek, article_type, category, tags, hero_gradient, hero_image_url, featured, upvotes, published_at",
    )
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  const all = rows ?? [];
  const brief = all.find((a) => a.article_type === "daily_brief") ?? null;
  const headlines = all.find((a) => a.article_type === "morning_headlines") ?? null;
  const deepDives = all.filter((a) => a.article_type === "deep_dive").slice(0, 4);
  const latest = all.filter((a) => a.id !== brief?.id && a.id !== headlines?.id).slice(0, 12);
  return { brief, headlines, deepDives, latest, totalCount: all.length };
});

/**
 * Kick off a fresh generation run. Unauthenticated in v1 — anyone with the
 * URL can trigger the editor. Fine for a public demo; wrap with auth before
 * production. Runs may take 15-40s depending on the model.
 */
export const triggerEditionGeneration = createServerFn({ method: "POST" }).handler(async () => {
  const { generateTodaysEdition } = await import("@/lib/generate-edition.server");
  const result = await generateTodaysEdition();
  return result;
});

export const triggerOpinionGeneration = createServerFn({ method: "POST" }).handler(async () => {
  const { generateOpinionEdition } = await import("@/lib/generate-opinion.server");
  const result = await generateOpinionEdition();
  return result;
});

export const triggerAnalysisGeneration = createServerFn({ method: "POST" }).handler(async () => {
  const { generateAnalysisEdition } = await import("@/lib/generate-analysis.server");
  const result = await generateAnalysisEdition();
  return result;
});

export const triggerTopicBackfill = createServerFn({ method: "POST" }).handler(async () => {
  const { backfillArticleTopics } = await import("@/lib/tag-articles.server");
  const result = await backfillArticleTopics();
  return result;
});

export const triggerBriefImage = createServerFn({ method: "POST" }).handler(async () => {
  const { attachTodaysBriefImage } = await import("@/lib/article-image.server");
  return attachTodaysBriefImage();
});

export const searchArticles = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ q: z.string().default(""), limit: z.number().int().min(1).max(50).default(30) }).parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const q = data.q.trim();
    if (q.length < 2) return [];
    const supabase = serverPublicClient();
    const { data: rows, error } = await supabase
      .from("articles")
      .select("id, slug, title, dek, article_type, category, tags, hero_gradient, featured, upvotes, published_at")
      .textSearch("search_vector", q, { type: "websearch", config: "english" })
      .order("published_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
