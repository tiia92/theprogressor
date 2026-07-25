import { normalizeTagsToTopics } from "@/lib/content-types";
// Server-only: generates the daily Opinion pair —
//   1) A "Voices Today" briefing that aggregates real opinion/editorial
//      pieces pulled from NewsAPI as a linked listicle.
//   2) An AI-authored opinion column on a topic drawn from the day's news.

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

// Major U.S. opinion desks. NewsAPI lets us filter /v2/everything by domain.
const OPINION_DOMAINS = [
  "nytimes.com",
  "washingtonpost.com",
  "theatlantic.com",
  "newyorker.com",
  "vox.com",
  "theguardian.com",
  "slate.com",
  "motherjones.com",
  "thenation.com",
  "newrepublic.com",
  "jacobin.com",
  "prospect.org",
  "commondreams.org",
  "msnbc.com",
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

async function fetchOpinionWire(limit: number): Promise<WireItem[]> {
  const key = process.env.NEWS_API_KEY;
  if (!key) throw new Error("NEWS_API_KEY not configured");
  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("domains", OPINION_DOMAINS.join(","));
  url.searchParams.set(
    "q",
    "opinion OR editorial OR column OR commentary OR essay",
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
  // Deduplicate by outlet so the listicle spans multiple voices.
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

// ---------- 1. Voices Today briefing (listicle) ----------

const BRIEFING_SYSTEM = `You are the opinion editor of NewSlop, a progressive daily news publication.

Your job: write a short intro (2-3 short paragraphs) framing today's opinion landscape from a mainstream progressive perspective, then hand off to a curated listicle of real opinion pieces published today by other outlets. You do NOT rewrite or summarize each item beyond a single sharp sentence — the listicle itself will be rendered from the wire.

Editorial principles:
- Fact-based, transparent, plain language. Short paragraphs.
- Progressive framing: pro-labor, pro-democracy, climate-serious, civil-rights-forward, healthcare-access-forward, skeptical of concentrated corporate and executive power.
- Never invent quotes or claim opinions the authors didn't express. Do NOT fabricate URLs.

Categories: politics, labor, climate, healthcare, housing, immigration, civil_rights, courts, elections, economy.
Hero gradients: sunrise, dusk, civic, labor, forest, court.

Return ONLY valid JSON (no prose, no code fences) matching:
{
  "title": string,          // e.g. "Voices Today: <theme of the day>"
  "dek": string,            // one-sentence deck
  "intro_markdown": string, // 2-3 short paragraphs of framing
  "items": [                // one entry per wire item, in the order shown, using the SAME url
    { "url": string, "outlet": string, "headline": string, "one_line": string }
  ],
  "closing_markdown": string, // one short paragraph inviting readers to weigh in
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
  return `${b.intro_markdown}\n\n## What the columnists are saying today\n\n${items}\n\n---\n\n${b.closing_markdown}`;
}

// ---------- 2. AI-authored opinion column ----------

const COLUMN_SYSTEM = `You are a staff opinion columnist at NewSlop, an autonomous progressive daily publication. Every day you publish ONE original opinion column.

Editorial voice:
- Mainstream American progressive: pro-labor, pro-democracy, climate-serious, civil-rights-forward, healthcare-access-forward, skeptical of concentrated corporate and executive power.
- Write with a clear thesis and argument. Take a position. Use "I" sparingly; make the case on the merits.
- Plain, direct language. Short paragraphs. Use ## subheads. 650-900 words.
- Ground the argument in a real news event from the wire the user gives you. Cite the outlet by name in-body where you reference it. Do NOT invent facts, quotes, or URLs beyond that source.
- End with a "## The bottom line" section that states clearly what you think should happen next.
- This is labeled OPINION on the site. Do not hedge into he-said/she-said neutrality — make an argument.

Categories: politics, labor, climate, healthcare, housing, immigration, civil_rights, courts, elections, economy.
Hero gradients: sunrise, dusk, civic, labor, forest, court.

Return ONLY valid JSON (no prose, no code fences) matching:
{
  "title": string,           // headline of the column
  "dek": string,             // one-sentence deck stating the argument
  "body": string,            // full column, markdown
  "category": string,
  "tags": string[],
  "hero_gradient": string
}`;

interface ColumnResponse {
  title: string;
  dek: string;
  body: string;
  category: string;
  tags: string[];
  hero_gradient: string;
}

// ---------- orchestration ----------

export async function generateOpinionEdition() {
  const wire = await fetchOpinionWire(8);
  if (!wire.length) throw new Error("No opinion wire items available");
  const date = todayISO();

  // ---- Briefing ----
  const briefingUser = `Today is ${date}. Here are real opinion/editorial pieces published in the last 36 hours from major U.S. outlets. Build the listicle from these exact items in the order given, preserving their URLs and outlet names verbatim. Keep each one_line under 25 words.

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
  // Enforce real URLs — replace any hallucinated ones with the wire's.
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
    // Fall back to the raw wire order if the model drifted.
    briefing.items = wire.map((w) => ({
      url: w.url,
      outlet: w.source,
      headline: w.title,
      one_line: w.description?.slice(0, 160) ?? "",
    }));
  }

  // ---- Column ----
  const anchor = wire[0];
  const columnUser = `Today is ${date}. Write today's opinion column, grounded in this real news item:

Headline: ${anchor.title}
Outlet: ${anchor.source}
URL: ${anchor.url}
Published: ${anchor.publishedAt}
Summary: ${anchor.description}

Make a clear progressive argument about what this story means and what should happen next. Cite ${anchor.source} by name where you reference the reporting.`;
  const columnRaw = await callGateway(COLUMN_SYSTEM, columnUser);
  const column = safeJson<ColumnResponse>(columnRaw);
  if (!column?.title || !column?.body) throw new Error("AI returned incomplete column");

  // ---- Insert ----
  const { data: existingRows } = await supabaseAdmin.from("articles").select("slug");
  const existing = new Set((existingRows ?? []).map((r) => r.slug));

  const briefingCategory = CATEGORIES.includes(briefing.category) ? briefing.category : "politics";
  const briefingHero = GRADIENTS.includes(briefing.hero_gradient) ? briefing.hero_gradient : "dusk";
  const briefingSlug = ensureUniqueSlug(
    `opinion-voices-${date}-${slugify(briefing.title)}`.slice(0, 100),
    existing,
  );

  const columnCategory = CATEGORIES.includes(column.category) ? column.category : "politics";
  const columnHero = GRADIENTS.includes(column.hero_gradient) ? column.hero_gradient : "sunrise";
  const columnSlug = ensureUniqueSlug(
    `opinion-column-${date}-${slugify(column.title)}`.slice(0, 100),
    existing,
  );

  const rows = [
    {
      slug: briefingSlug,
      title: briefing.title,
      dek: briefing.dek,
      body: briefingToMarkdown(briefing),
      article_type: "opinion",
      category: briefingCategory,
      tags: normalizeTagsToTopics(briefing.tags ?? []),
      sources: briefing.items.map((it) => ({
        title: `${it.outlet}: ${it.headline}`,
        url: it.url,
      })),
      hero_gradient: briefingHero,
      featured: false,
    },
    {
      slug: columnSlug,
      title: column.title,
      dek: column.dek,
      body: column.body,
      article_type: "opinion",
      category: columnCategory,
      tags: normalizeTagsToTopics(column.tags ?? []),
      sources: [{ title: `${anchor.source}: ${anchor.title}`, url: anchor.url }],
      hero_gradient: columnHero,
      featured: false,
    },
  ];

  const { error } = await supabaseAdmin.from("articles").insert(rows);
  if (error) throw new Error(`DB insert failed: ${error.message}`);

  return { inserted: rows.length, slugs: rows.map((r) => r.slug) };
}
