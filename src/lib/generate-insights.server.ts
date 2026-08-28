// Server-only: the Insights desk.
//
// Pipeline:
//   1. Detect    — find developing stories in the week's published articles.
//   2. Aggregate — pull the same week's reporting from many outlets via NewsAPI.
//   3. Compare   — corroboration, disagreement, allegations, unknowns, prior context.
//   4. Classify  — every claim as confirmed fact / reported claim / analysis /
//                  political rhetoric / unknown.
//   5. Persist   — report to Postgres (system of record), claims to ClickHouse
//                  (analytics store).

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { recordClaims, type ClaimRow } from "@/lib/clickhouse.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const WIRE_DOMAINS = [
  "reuters.com",
  "apnews.com",
  "nytimes.com",
  "washingtonpost.com",
  "wsj.com",
  "politico.com",
  "axios.com",
  "npr.org",
  "nbcnews.com",
  "cbsnews.com",
  "abcnews.go.com",
  "cnn.com",
  "theguardian.com",
  "bloomberg.com",
  "thehill.com",
  "propublica.org",
];

export type Classification =
  | "confirmed_fact"
  | "reported_claim"
  | "analysis"
  | "political_rhetoric"
  | "unknown";

export interface InsightClaim {
  text: string;
  classification: Classification;
  corroborating_sources: number;
  disputed: boolean;
  attribution?: string;
  note?: string;
}

export interface InsightStory {
  slug: string;
  title: string;
  status: string;
  summary: string;
  topics: string[];
  outlets: string[];
  claims: InsightClaim[];
  disagreements: string[];
  unknowns: string[];
  prior_context: string[];
  article_slugs: string[];
}

interface ModelResponse {
  title: string;
  summary: string;
  synthesis: string;
  confirmed: string[];
  disputed: string[];
  allegations: string[];
  unknowns: string[];
  prior_context: string[];
  stories: InsightStory[];
}

interface WireItem {
  title: string;
  description: string;
  source: string;
  url: string;
  publishedAt: string;
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Most recent Monday (UTC) at or before `ref`, minus a full week when the week is not yet over. */
export function defaultWeekStart(ref = new Date()): string {
  const d = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));
  const dow = d.getUTCDay(); // 0 = Sunday
  const offset = dow === 0 ? 6 : dow - 1;
  d.setUTCDate(d.getUTCDate() - offset);
  return iso(d);
}

// ---------- 1 + 2. Detect and aggregate ----------

async function fetchOwnArticles(from: string, to: string) {
  const { data, error } = await supabaseAdmin
    .from("articles")
    .select("slug, title, dek, body, article_type, category, tags, sources, published_at")
    .gte("published_at", `${from}T00:00:00Z`)
    .lte("published_at", `${to}T23:59:59Z`)
    .order("published_at", { ascending: false })
    .limit(80);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchWire(from: string, to: string): Promise<WireItem[]> {
  const key = process.env['NEWS_API_KEY'];
  if (!key) return [];
  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("domains", WIRE_DOMAINS.join(","));
  url.searchParams.set(
    "q",
    "politics OR congress OR court OR election OR labor OR climate OR immigration OR healthcare",
  );
  url.searchParams.set("language", "en");
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("pageSize", "100");
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  const resp = await fetch(url.toString(), {
    headers: { "X-Api-Key": key, "User-Agent": "TheProgressor/1.0 (+https://theprogressor.lovable.app)" },
  });
  if (!resp.ok) {
    console.error(`[insights] NewsAPI ${resp.status}: ${await resp.text()}`);
    return [];
  }
  const data = (await resp.json()) as {
    articles?: {
      title?: string;
      description?: string;
      url?: string;
      publishedAt?: string;
      source?: { name?: string };
    }[];
  };
  return (data.articles ?? [])
    .filter((a) => a.title && a.url && a.title !== "[Removed]")
    .slice(0, 90)
    .map((a) => ({
      title: a.title!,
      description: a.description ?? "",
      source: a.source?.name ?? "Unknown",
      url: a.url!,
      publishedAt: a.publishedAt ?? "",
    }));
}

// ---------- 3 + 4. Compare and classify ----------

const SYSTEM = `You are the Insights desk of The Progressor, an autonomous progressive news publication.

You are given (a) the articles The Progressor published this week and (b) raw reporting on the same week from many outlets. Your job is EVIDENCE ACCOUNTING, not fresh opinion writing.

For the week as a whole and for each developing story you identify, you must separate:
- confirmed_fact: independently corroborated by two or more distinct outlets, or a matter of public record (a filed document, an official vote, a published number).
- reported_claim: reported by an outlet or asserted by a named party, not independently corroborated. Allegations, indictments, lawsuits and anonymous-source claims live here.
- analysis: interpretation, projection, or causal explanation — including The Progressor's own.
- political_rhetoric: framing, spin, campaign messaging, or partisan characterization.
- unknown: material questions the reporting does not answer.

Rules:
- Never upgrade a claim's status to make a story cleaner. When in doubt, downgrade.
- Attribute reported claims to who said them.
- Note explicitly where accounts disagree and what the disagreement is about.
- Prior context = what happened before this week that a reader needs to understand the story.
- Progressive lens is allowed in emphasis and in what you consider important; it must never change how you classify evidence.
- Do NOT invent facts, quotes, outlets, or URLs. Only use outlets present in the material given.
- Plain, direct language. No hedging padding.

Pick 3 to 6 developing stories. Return ONLY valid JSON (no prose, no code fences):
{
  "title": string,           // e.g. "Insights: the week of ..."
  "summary": string,         // one sentence
  "synthesis": string,       // 3-5 short paragraphs, markdown, synthesizing the week
  "confirmed": string[],     // week-level: what is independently corroborated
  "disputed": string[],      // week-level: where accounts disagree
  "allegations": string[],   // week-level: claims that remain allegations
  "unknowns": string[],      // week-level: what remains unknown
  "prior_context": string[], // week-level: what came before that explains this week
  "stories": [
    {
      "slug": string,        // kebab-case
      "title": string,
      "status": string,      // e.g. "Developing", "Escalating", "Stalled"
      "summary": string,     // 2-3 sentences
      "topics": string[],
      "outlets": string[],   // outlets that reported it, from the material given
      "claims": [
        {
          "text": string,
          "classification": "confirmed_fact" | "reported_claim" | "analysis" | "political_rhetoric" | "unknown",
          "corroborating_sources": number,
          "disputed": boolean,
          "attribution": string,
          "note": string
        }
      ],
      "disagreements": string[],
      "unknowns": string[],
      "prior_context": string[],
      "article_slugs": string[]  // slugs of Progressor articles covering it, from the material given
    }
  ]
}`;

async function callModel(user: string): Promise<ModelResponse> {
  const apiKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    if (resp.status === 429) throw new Error("AI rate limit — try again shortly");
    if (resp.status === 402) throw new Error("AI credits exhausted");
    throw new Error(`AI gateway ${resp.status}: ${text}`);
  }
  const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("Empty AI response");
  try {
    return JSON.parse(content) as ModelResponse;
  } catch {
    const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    return JSON.parse(cleaned) as ModelResponse;
  }
}

const VALID: Classification[] = [
  "confirmed_fact",
  "reported_claim",
  "analysis",
  "political_rhetoric",
  "unknown",
];

function normalize(res: ModelResponse): ModelResponse {
  const stories = (res.stories ?? []).slice(0, 8).map((s, i) => ({
    slug: slugify(s.slug || s.title || `story-${i + 1}`) || `story-${i + 1}`,
    title: s.title ?? "Untitled story",
    status: s.status ?? "Developing",
    summary: s.summary ?? "",
    topics: Array.isArray(s.topics) ? s.topics.slice(0, 6) : [],
    outlets: Array.isArray(s.outlets) ? s.outlets.slice(0, 12) : [],
    claims: (Array.isArray(s.claims) ? s.claims : []).slice(0, 24).map((c) => ({
      text: c.text ?? "",
      classification: VALID.includes(c.classification) ? c.classification : "unknown",
      corroborating_sources: Math.max(0, Math.min(255, Number(c.corroborating_sources) || 0)),
      disputed: Boolean(c.disputed),
      attribution: c.attribution ?? "",
      note: c.note ?? "",
    })),
    disagreements: Array.isArray(s.disagreements) ? s.disagreements : [],
    unknowns: Array.isArray(s.unknowns) ? s.unknowns : [],
    prior_context: Array.isArray(s.prior_context) ? s.prior_context : [],
    article_slugs: Array.isArray(s.article_slugs) ? s.article_slugs : [],
  }));
  return {
    title: res.title ?? "Insights",
    summary: res.summary ?? "",
    synthesis: res.synthesis ?? "",
    confirmed: res.confirmed ?? [],
    disputed: res.disputed ?? [],
    allegations: res.allegations ?? [],
    unknowns: res.unknowns ?? [],
    prior_context: res.prior_context ?? [],
    stories,
  };
}

// ---------- 5. Orchestration ----------

export interface GenerateInsightsOptions {
  weekStart?: string;
  weekEnd?: string;
}

export async function generateInsightsReport(opts: GenerateInsightsOptions = {}) {
  const weekStart = opts.weekStart ?? defaultWeekStart();
  const weekEnd =
    opts.weekEnd ?? iso(new Date(new Date(`${weekStart}T00:00:00Z`).getTime() + 6 * 86_400_000));

  const [own, wire] = await Promise.all([fetchOwnArticles(weekStart, weekEnd), fetchWire(weekStart, weekEnd)]);

  if (own.length === 0 && wire.length === 0) {
    throw new Error(`No coverage found for ${weekStart} – ${weekEnd}`);
  }

  const ownBlock = own
    .map(
      (a) =>
        `- [${a.article_type}/${a.category}] slug=${a.slug} | ${a.title} — ${a.dek} | tags: ${(a.tags ?? []).join(", ")} | published ${String(a.published_at).slice(0, 10)}\n  excerpt: ${String(a.body ?? "").replace(/\s+/g, " ").slice(0, 700)}`,
    )
    .join("\n");

  const wireBlock = wire
    .map((w) => `- [${w.source}] ${w.title} — ${w.description} (${w.publishedAt.slice(0, 10)}) ${w.url}`)
    .join("\n");

  const user = [
    `TODAY'S DATE: ${iso(new Date())}`,
    `WEEK UNDER REVIEW: ${weekStart} to ${weekEnd}`,
    "",
    `THE PROGRESSOR PUBLISHED THIS WEEK (${own.length} articles):`,
    ownBlock || "(none)",
    "",
    `OUTSIDE REPORTING FROM MULTIPLE OUTLETS (${wire.length} items):`,
    wireBlock || "(none)",
    "",
    "Detect the developing stories, aggregate the reporting across outlets, compare the accounts, and classify every claim. Return the JSON object.",
  ].join("\n");

  const report = normalize(await callModel(user));

  const slug = `week-of-${weekStart}`;
  const outlets = Array.from(new Set(wire.map((w) => w.source)));
  const sources = wire.slice(0, 40).map((w) => ({ outlet: w.source, title: w.title, url: w.url }));

  const { data: saved, error } = await supabaseAdmin
    .from("insight_reports")
    .upsert(
      {
        slug,
        week_start: weekStart,
        week_end: weekEnd,
        title: report.title,
        summary: report.summary,
        synthesis: report.synthesis,
        confirmed: report.confirmed,
        disputed: report.disputed,
        allegations: report.allegations,
        unknowns: report.unknowns,
        prior_context: report.prior_context,
        stories: report.stories as unknown as import("@/integrations/supabase/types").Json,
        sources,
        article_count: own.length,
        status: "published",
        published_at: new Date().toISOString(),
      },
      { onConflict: "slug" },
    )
    .select("id, slug")
    .single();
  if (error) throw new Error(error.message);

  const claimRows: ClaimRow[] = report.stories.flatMap((s) =>
    s.claims.map((c) => ({
      report_id: saved!.id,
      week_start: weekStart,
      story_slug: s.slug,
      story_title: s.title,
      claim_text: c.text,
      classification: c.classification,
      corroborating_sources: c.corroborating_sources,
      disputed: c.disputed ? 1 : 0,
      topics: s.topics,
      outlets: s.outlets,
    })),
  );
  const analytics = await recordClaims(claimRows);

  return {
    slug,
    weekStart,
    weekEnd,
    stories: report.stories.length,
    claims: claimRows.length,
    articlesReviewed: own.length,
    wireItems: wire.length,
    outlets: outlets.length,
    analytics,
  };
}
