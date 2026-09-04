// Server-only: The Progressor's own news archive.
//
// Every wire item we ever fetch is stored here, plus a historical backfill from
// GDELT. Generators query it for dated prior coverage so the AI can ground
// "what happened before" in real, citable headlines instead of memory.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface ArchiveItem {
  url: string;
  title: string;
  summary?: string;
  outlet?: string;
  publishedAt: string; // ISO date or datetime
  topics?: string[];
  source?: string;
}

export interface ArchiveRow {
  url: string;
  title: string;
  summary: string;
  outlet: string;
  published_at: string;
  topics: string[];
}

function normalizeUrl(raw: string) {
  try {
    const u = new URL(raw);
    u.hash = "";
    for (const p of [...u.searchParams.keys()]) {
      if (p.startsWith("utm_") || p === "fbclid" || p === "gclid") u.searchParams.delete(p);
    }
    return u.toString();
  } catch {
    return raw;
  }
}

/**
 * Store wire/archive items. Duplicate URLs are ignored, never overwritten.
 * Never throws — archiving must not break generation.
 */
export async function storeArchiveItems(items: ArchiveItem[], source = "newsapi") {
  if (!items.length) return 0;
  const seen = new Set<string>();
  const rows = items
    .filter((i) => i.url && i.title && i.title !== "[Removed]")
    .map((i) => ({
      url: normalizeUrl(i.url),
      title: i.title.slice(0, 500),
      summary: (i.summary ?? "").slice(0, 2000),
      outlet: (i.outlet ?? "").slice(0, 160),
      published_at: i.publishedAt ? new Date(i.publishedAt).toISOString() : new Date().toISOString(),
      topics: i.topics ?? [],
      source: i.source ?? source,
    }))
    .filter((r) => {
      if (!Number.isFinite(new Date(r.published_at).getTime())) return false;
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

  if (!rows.length) return 0;

  try {
    const { error, count } = await supabaseAdmin
      .from("news_archive")
      .upsert(rows, { onConflict: "url", ignoreDuplicates: true, count: "exact" });
    if (error) {
      console.error("[news-archive] store failed", error.message);
      return 0;
    }
    return count ?? rows.length;
  } catch (e) {
    console.error("[news-archive] store threw", e);
    return 0;
  }
}

function toWebSearchQuery(terms: string[]) {
  const cleaned = terms
    .map((t) => t.replace(/["']/g, " ").trim())
    .filter((t) => t.length > 2)
    .slice(0, 8);
  if (!cleaned.length) return "";
  return cleaned.map((t) => (t.includes(" ") ? `"${t}"` : t)).join(" OR ");
}

/**
 * Prior coverage for a story: archived headlines matching any of `terms`,
 * published before `before` and within the last `years`.
 */
export async function lookupPriorCoverage(opts: {
  terms: string[];
  limit?: number;
  years?: number;
  before?: string;
}): Promise<ArchiveRow[]> {
  const query = toWebSearchQuery(opts.terms);
  if (!query) return [];
  const limit = opts.limit ?? 15;
  const years = opts.years ?? 3;
  const before = opts.before ? new Date(opts.before) : new Date();
  const since = new Date(before.getTime() - years * 365 * 86_400_000);

  try {
    const { data, error } = await supabaseAdmin
      .from("news_archive")
      .select("url, title, summary, outlet, published_at, topics")
      .textSearch("search_vector", query, { type: "websearch", config: "english" })
      .gte("published_at", since.toISOString())
      .lt("published_at", before.toISOString())
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("[news-archive] lookup failed", error.message);
      return [];
    }
    return (data ?? []) as ArchiveRow[];
  } catch (e) {
    console.error("[news-archive] lookup threw", e);
    return [];
  }
}

/** A compact, citable block for the model prompt. */
export function formatPriorCoverage(rows: ArchiveRow[]) {
  if (!rows.length) return "";
  return rows
    .map(
      (r) =>
        `- (${r.published_at.slice(0, 10)}) [${r.outlet || "unknown outlet"}] ${r.title}${
          r.summary ? ` — ${r.summary.replace(/\s+/g, " ").slice(0, 200)}` : ""
        } ${r.url}`,
    )
    .join("\n");
}

/**
 * Convenience: build a "prior context" prompt block from a set of topical
 * search terms. Returns "" when nothing relevant is archived.
 */
export async function priorContextBlock(terms: string[], limit = 15, before?: string) {
  const rows = await lookupPriorCoverage({ terms, limit, before });
  const block = formatPriorCoverage(rows);
  if (!block) return "";
  return `PRIOR COVERAGE FROM THE PROGRESSOR'S NEWS ARCHIVE (real, dated headlines from the last three years — use these for background and cite them by outlet and date; do not assert details they do not contain):\n${block}`;
}

export async function archiveStats() {
  const { count } = await supabaseAdmin
    .from("news_archive")
    .select("id", { count: "exact", head: true });
  const { data: oldest } = await supabaseAdmin
    .from("news_archive")
    .select("published_at")
    .order("published_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return { rows: count ?? 0, oldest: oldest?.published_at ?? null };
}
