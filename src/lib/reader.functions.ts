import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LIST_COLUMNS =
  "id, slug, title, dek, article_type, category, tags, hero_gradient, featured, upvotes, published_at";

/** Everything the signed-in reader's UI needs in one round trip. */
export const getReaderState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [topics, keywords, saves] = await Promise.all([
      supabase.from("followed_topics").select("topic_slug").eq("user_id", userId),
      supabase.from("followed_keywords").select("keyword").eq("user_id", userId).order("created_at"),
      supabase.from("saved_articles").select("article_id").eq("user_id", userId),
    ]);
    return {
      topics: (topics.data ?? []).map((r) => r.topic_slug),
      keywords: (keywords.data ?? []).map((r) => r.keyword),
      savedIds: (saves.data ?? []).map((r) => r.article_id),
    };
  });

export const toggleFollowTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ topic: z.string().min(1), follow: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.follow) {
      const { error } = await supabase
        .from("followed_topics")
        .upsert({ user_id: userId, topic_slug: data.topic }, { onConflict: "user_id,topic_slug" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("followed_topics")
        .delete()
        .eq("user_id", userId)
        .eq("topic_slug", data.topic);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const addKeyword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ keyword: z.string().min(2).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    const keyword = data.keyword.trim().toLowerCase();
    const { error } = await context.supabase
      .from("followed_keywords")
      .upsert({ user_id: context.userId, keyword }, { onConflict: "user_id,keyword" });
    if (error) throw new Error(error.message);
    return { ok: true, keyword };
  });

export const removeKeyword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ keyword: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("followed_keywords")
      .delete()
      .eq("user_id", context.userId)
      .eq("keyword", data.keyword);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleSaveArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ articleId: z.string().uuid(), save: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.save) {
      const { error } = await supabase
        .from("saved_articles")
        .upsert({ user_id: userId, article_id: data.articleId }, { onConflict: "user_id,article_id" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("saved_articles")
        .delete()
        .eq("user_id", userId)
        .eq("article_id", data.articleId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const listSavedArticles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: saves, error } = await supabase
      .from("saved_articles")
      .select("article_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const ids = (saves ?? []).map((s) => s.article_id);
    if (ids.length === 0) return [];
    const { data: rows, error: e2 } = await supabase
      .from("articles")
      .select(LIST_COLUMNS)
      .in("id", ids);
    if (e2) throw new Error(e2.message);
    const order = new Map(ids.map((id, i) => [id, i]));
    return (rows ?? []).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  });

/** Articles matching the reader's followed topics or keywords. */
export const getFollowFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [t, k] = await Promise.all([
      supabase.from("followed_topics").select("topic_slug").eq("user_id", userId),
      supabase.from("followed_keywords").select("keyword").eq("user_id", userId),
    ]);
    const topics = (t.data ?? []).map((r) => r.topic_slug);
    const keywords = (k.data ?? []).map((r) => r.keyword);
    if (topics.length === 0 && keywords.length === 0) return [];

    const results: Record<string, unknown>[] = [];
    if (topics.length > 0) {
      const { data } = await supabase
        .from("articles")
        .select(LIST_COLUMNS)
        .overlaps("tags", topics)
        .order("published_at", { ascending: false })
        .limit(40);
      results.push(...(data ?? []));
    }
    if (keywords.length > 0) {
      const query = keywords.map((w) => `'${w.replace(/'/g, "")}'`).join(" | ");
      const { data } = await supabase
        .from("articles")
        .select(LIST_COLUMNS)
        .textSearch("search_vector", query)
        .order("published_at", { ascending: false })
        .limit(40);
      results.push(...(data ?? []));
    }
    const seen = new Set<string>();
    const merged = results.filter((r) => {
      const id = r["id"] as string;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    merged.sort(
      (a, b) =>
        new Date(b["published_at"] as string).getTime() -
        new Date(a["published_at"] as string).getTime(),
    );
    return merged.slice(0, 40) as unknown as {
      id: string;
      slug: string;
      title: string;
      dek: string;
      article_type: string;
      category: string;
      tags: string[];
      hero_gradient: string;
      featured: boolean;
      upvotes: number;
      published_at: string;
    }[];
  });

export const getMyReaction = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ articleId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("article_reactions")
      .select("value")
      .eq("user_id", context.userId)
      .eq("article_id", data.articleId)
      .maybeSingle();
    return { value: row?.value ?? 0 };
  });

export const setReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ articleId: z.string().uuid(), value: z.number().int().min(-1).max(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.value === 0) {
      const { error } = await supabase
        .from("article_reactions")
        .delete()
        .eq("user_id", userId)
        .eq("article_id", data.articleId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("article_reactions").upsert(
        { user_id: userId, article_id: data.articleId, value: data.value },
        { onConflict: "user_id,article_id" },
      );
      if (error) throw new Error(error.message);
    }
    const { data: row } = await supabase
      .from("articles")
      .select("upvotes")
      .eq("id", data.articleId)
      .maybeSingle();
    return { value: data.value, upvotes: row?.upvotes ?? 0 };
  });
