// Server-only: generates the daily Analysis package —
//   1) An "Analysis Briefing" listicle of real analysis/explanatory pieces
//      pulled from NewsAPI (major U.S. outlets known for analysis desks).
//   2) 1–3 AI-authored analysis articles grounded in top wire stories.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const GRADIENTS = ["sunrise", "dusk", "civic", "labor", "forest", "court"];
const CATEGORIES = [
  "politics",
  "labor",
  "climate",
  "healthcare",
  "housing",
  "immigration",
  "civil_rights",
  "courts",
  "elections",
  "economy",
];

// Outlets with prominent analysis / explanatory journalism desks.
const ANALYSIS_DOMAINS = [
  "nytimes.com",
  "washingtonpost.com",
  "theatlantic.com",
  "vox.com",
  "fivethirtyeight.com",
  "politico.com",
  "axios.com",
  "reuters.com",
  "apnews.com",
  "bloomberg.com",
  "theguardian.com",
  "propublica.org",
  "nbcnews.com",
  "cnn.com",
];

interface WireItem {
  title: string;
  description?: string;
  source: string;
  url: string;
  publishedAt: string;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
function ensureUniqueSlug(base: string, existing: Set<string>) {
  let slug = base;
  let n = 2;
  while (existing.has(slug)) slug = `${base}-${n++}`;
  existing.add(slug);
  return slug;
}

async function fetchAnalysisWire(limit: number): Promise<WireItem[]> {
  const key = process.env.NEWS_API_KEY;
  if (!key) throw new Error("NEWS_API_KEY not configured");
  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("domains", ANALYSIS_DOMAINS.join(","));
  url.searchParams.set(
    "q",
    "analysis OR explainer OR \"what it means\" OR context OR breakdown",
  );
  url.searchParams.set("language", "en");
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("pageSize", String(Math.min(limit * 3, 60)));
  const since = new Date(Date.now() - 36 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  url.searchParams.set("from", since);
  const resp = await fetch(url.toString(), { headers: { "X-Api-Key": key } });
  if (!resp.ok) throw new Error(`NewsAPI ${resp.status}: ${await resp.text()}`);
  const data = (await resp.json()) as {
    articles?: {
      title?: string;
      description?: string;
      url?: string;
      publishedAt?: string;
      source?: { name?: string };
    }[];
  };
  const seenSource = new Set<string>();
  const items: WireItem[] = [];
  for (const a of data.articles ?? []) {
    if (!a.title || !a.url || a.title === "[Removed]") continue;
    const src = a.source?.name ?? "Unknown";
    if (seenSource.has(src)) continue;
    seenSource.add(src);
    items.push({
      title: a.title,
      description: a.description ?? "",
      source: src,
      url: a.url,
      publishedAt: a.publishedAt ?? "",
    });
    if (items.length >= limit) break;
  }
  return items;
}

// Fallback: top U.S. headlines, used to anchor the AI-authored analyses if the
// filtered analysis wire is thin.
async function fetchTopHeadlines(limit: number): Promise<WireItem[]> {
  const key = process.env.NEWS_API_KEY;
  if (!key) throw new Error("NEWS_API_KEY not configured");
  const url = new URL("https://newsapi.org/v2/top-headlines");
  url.searchParams.set("country", "us");
  url.searchParams.set("pageSize", String(Math.min(limit * 2, 50)));
  const resp = await fetch(url.toString(), { headers: { "X-Api-Key": key } });
  if (!resp.ok) throw new Error(`NewsAPI ${resp.status}: ${await resp.text()}`);
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
    .slice(0, limit)
    .map((a) => ({
      title: a.title!,
      description: a.description ?? "",
      source: a.source?.name ?? "Unknown",
      url: a.url!,
      publishedAt: a.publishedAt ?? "",
    }));
}

async function callGateway(system: string, user: string): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    if (resp.status === 429) throw new Error("AI rate limit");
    if (resp.status === 402) throw new Error("AI credits exhausted");
    throw new Error(`AI gateway ${resp.status}: ${text}`);
  }
  const data = (await resp.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("Empty AI response");
  return content;
}

function safeJson<T>(content: string): T {
  try {
    return JSON.parse(content) as T;
  } catch {
    const cleaned = content
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
    return JSON.parse(cleaned) as T;
  }
}

// ---------- 1. Analysis briefing (listicle) ----------

const BRIEFING_SYSTEM = `You are the analysis editor of NewSlop, a progressive daily news publication.

Your job: write a short intro (2-3 short paragraphs) framing the day's most important analytical stories from a mainstream progressive perspective, then hand off to a curated listicle of real analysis/explanatory pieces from other outlets. You do NOT rewrite each item beyond a single sharp sentence — the listicle is rendered from the wire.

Editorial principles:
- Fact-based, transparent, plain language. Short paragraphs.
- Label interpretation as interpretation. Distinguish reporting from analysis.
- Progressive framing: pro-labor, pro-democracy, climate-serious, civil-rights-forward, healthcare-access-forward, skeptical of concentrated corporate and executive power.
- Never invent quotes or claims. Do NOT fabricate URLs.

Categories: politics, labor, climate, healthcare, housing, immigration, civil_rights, courts, elections, economy.
Hero gradients: sunrise, dusk, civic, labor, forest, court.

Return ONLY valid JSON (no prose, no code fences) matching:
{
  "title": string,          // e.g. "Analysis Briefing: <theme of the day>"
  "dek": string,            // one-sentence deck
  "intro_markdown": string, // 2-3 short paragraphs of framing
  "items": [                // one entry per wire item, same order, SAME url verbatim
    { "url": string, "outlet": string, "headline": string, "one_line": string }
  ],
  "closing_markdown": string, // one short paragraph on what to watch next
  "category": string,
  "tags": string[],
  "hero_gradient": string
}`;

interface BriefingResponse {
  title: string;
  dek: string;
  intro_markdown: string;
  items: { url: string; outlet: string; headline: string; one_line: string }[];
  closing_markdown: string;
  category: string;
  tags: string[];
  hero_gradient: string;
}

function briefingToMarkdown(b: BriefingResponse): string {
  const items = b.items
    .map(
      (it) =>
        `### [${it.headline}](${it.url})\n**${it.outlet}** — ${it.one_line}`,
    )
    .join("\n\n");
  return `${b.intro_markdown}\n\n## What the analysts are saying today\n\n${items}\n\n---\n\n${b.closing_markdown}`;
}

// ---------- 2. AI-authored analysis articles ----------

const ANALYSIS_SYSTEM = `You are a staff analyst at NewSlop, an autonomous progressive daily publication. Your job is to write ONE analytical article that explains what a specific news story means, who benefits, who is harmed, and what to watch next.

Editorial voice:
- Mainstream American progressive analytical lens: pro-labor, pro-democracy, climate-serious, civil-rights-forward, healthcare-access-forward, skeptical of concentrated corporate and executive power.
- This is ANALYSIS, not opinion — build interpretation from evidence, name your assumptions, and label speculation as speculation. But do not retreat into false balance.
- Plain, direct language. Short paragraphs. Use ## subheads. 600-900 words.
- Ground the article in the real news event from the wire the user gives you. Cite the outlet by name in-body where you reference the reporting. Do NOT invent facts, quotes, or URLs beyond that source.
- Include a "## What to watch next" section at the end.

Categories: politics, labor, climate, healthcare, housing, immigration, civil_rights, courts, elections, economy.
Hero gradients: sunrise, dusk, civic, labor, forest, court.

Return ONLY valid JSON (no prose, no code fences) matching:
{
  "title": string,
  "dek": string,             // one-sentence deck framing the interpretation
  "body": string,            // full analysis, markdown
  "category": string,
  "tags": string[],
  "hero_gradient": string
}`;

interface AnalysisResponse {
  title: string;
  dek: string;
  body: string;
  category: string;
  tags: string[];
  hero_gradient: string;
}

// ---------- orchestration ----------

export async function generateAnalysisEdition(options?: { columns?: number }) {
  const columns = Math.max(1, Math.min(options?.columns ?? 2, 3));

  const wire = await fetchAnalysisWire(8);
  if (!wire.length) throw new Error("No analysis wire items available");
  const date = todayISO();

  // ---- Briefing ----
  const briefingUser = `Today is ${date}. Here are real analysis/explanatory pieces published in the last 36 hours from major U.S. outlets. Build the listicle from these exact items in the order given, preserving their URLs and outlet names verbatim. Keep each one_line under 25 words.

${wire
  .map(
    (w, i) =>
      `[${i + 1}] ${w.title}\n    Outlet: ${w.source}\n    URL: ${w.url}\n    ${w.description ?? ""}`,
  )
  .join("\n\n")}`;

  const briefingRaw = await callGateway(BRIEFING_SYSTEM, briefingUser);
  const briefing = safeJson<BriefingResponse>(briefingRaw);
  if (!briefing?.title || !briefing?.items?.length) {
    throw new Error("AI returned incomplete briefing");
  }
  briefing.items = briefing.items
    .map((it) => {
      const match = wire.find(
        (w) => w.url === it.url || w.title === it.headline,
      );
      return match
        ? { ...it, url: match.url, outlet: match.source, headline: match.title ?? it.headline }
        : it;
    })
    .filter((it) => wire.some((w) => w.url === it.url));
  if (!briefing.items.length) {
    briefing.items = wire.map((w) => ({
      url: w.url,
      outlet: w.source,
      headline: w.title,
      one_line: w.description?.slice(0, 160) ?? "",
    }));
  }

  // ---- AI-authored analyses ----
  // Anchor each column on a distinct top-headline story so we get variety.
  let anchors = await fetchTopHeadlines(columns * 2);
  if (anchors.length < columns) anchors = [...anchors, ...wire];
  anchors = anchors.slice(0, columns);

  const analyses: (AnalysisResponse & { anchor: WireItem })[] = [];
  for (const anchor of anchors) {
    try {
      const user = `Today is ${date}. Write today's analysis, grounded in this real news item:

Headline: ${anchor.title}
Outlet: ${anchor.source}
URL: ${anchor.url}
Published: ${anchor.publishedAt}
Summary: ${anchor.description}

Explain what this story actually means, who benefits, who is harmed, and what to watch next. Cite ${anchor.source} by name where you reference the reporting.`;
      const raw = await callGateway(ANALYSIS_SYSTEM, user);
      const parsed = safeJson<AnalysisResponse>(raw);
      if (!parsed?.title || !parsed?.body) continue;
      analyses.push({ ...parsed, anchor });
    } catch (e) {
      console.error("[generate-analysis] column failed", e);
    }
  }

  // ---- Insert ----
  const { data: existingRows } = await supabaseAdmin.from("articles").select("slug");
  const existing = new Set((existingRows ?? []).map((r) => r.slug));

  const briefingCategory = CATEGORIES.includes(briefing.category) ? briefing.category : "politics";
  const briefingHero = GRADIENTS.includes(briefing.hero_gradient) ? briefing.hero_gradient : "civic";
  const briefingSlug = ensureUniqueSlug(
    `analysis-briefing-${date}-${slugify(briefing.title)}`.slice(0, 100),
    existing,
  );

  interface ArticleRow {
    slug: string;
    title: string;
    dek: string;
    body: string;
    article_type: string;
    category: string;
    tags: string[];
    sources: { title: string; url: string }[];
    hero_gradient: string;
    featured: boolean;
  }
  const rows: ArticleRow[] = [
    {
      slug: briefingSlug,
      title: briefing.title,
      dek: briefing.dek,
      body: briefingToMarkdown(briefing),
      article_type: "analysis",
      category: briefingCategory,
      tags: briefing.tags ?? [],
      sources: briefing.items.map((it) => ({
        title: `${it.outlet}: ${it.headline}`,
        url: it.url,
      })),
      hero_gradient: briefingHero,
      featured: false,
    },
  ];

  for (const a of analyses) {
    const cat = CATEGORIES.includes(a.category) ? a.category : "politics";
    const hero = GRADIENTS.includes(a.hero_gradient) ? a.hero_gradient : "dusk";
    const slug = ensureUniqueSlug(
      `analysis-${date}-${slugify(a.title)}`.slice(0, 100),
      existing,
    );
    rows.push({
      slug,
      title: a.title,
      dek: a.dek,
      body: a.body,
      article_type: "analysis",
      category: cat,
      tags: a.tags ?? [],
      sources: [{ title: `${a.anchor.source}: ${a.anchor.title}`, url: a.anchor.url }],
      hero_gradient: hero,
      featured: false,
    });
  }

  const { error } = await supabaseAdmin.from("articles").insert(rows);
  if (error) throw new Error(`DB insert failed: ${error.message}`);

  return { inserted: rows.length, slugs: rows.map((r) => r.slug) };
}
