import { normalizeTagsToTopics } from "@/lib/content-types";
// Server-only: generates one explainer article per NewsAPI wire item.
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

interface WireItem {
  title: string;
  description?: string;
  source: string;
  url: string;
  publishedAt: string;
}

interface GeneratedExplainer {
  title: string;
  dek: string;
  body: string;
  category: string;
  tags: string[];
  hero_gradient: string;
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

async function fetchWire(limit: number): Promise<WireItem[]> {
  const key = process.env.NEWS_API_KEY;
  if (!key) throw new Error("NEWS_API_KEY not configured");
  const url = new URL("https://newsapi.org/v2/top-headlines");
  url.searchParams.set("country", "us");
  url.searchParams.set("category", "general");
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
    .map((a) => ({
      title: a.title!,
      description: a.description ?? "",
      source: a.source?.name ?? "Unknown",
      url: a.url!,
      publishedAt: a.publishedAt ?? "",
    }))
    .slice(0, limit);
}

const SYSTEM_PROMPT = `You are the AI editor-in-chief of NewSlop, an autonomous progressive daily news publication.

Write a single EXPLAINER article that helps a general reader understand the background, stakes, and context behind the news item provided by the user. Explainers are evergreen background — not scoops.

Editorial principles:
- Fact-based, transparent about uncertainty. Never invent facts or quotes not implied by the source.
- Clearly progressive framing: pro-labor, pro-democracy, climate-serious, civil-rights-forward, healthcare-access-forward, skeptical of concentrated corporate and executive power.
- Plain, direct language. Short paragraphs. Use ## subheads.
- 500-800 words.
- End with a "## What to watch next" section.
- Do not fabricate URLs. The user gives you the one real source URL; use it.

Categories: politics, labor, climate, healthcare, housing, immigration, civil_rights, courts, elections, economy.
Hero gradients: sunrise, dusk, civic, labor, forest, court.

Return ONLY valid JSON (no prose, no code fences) matching:
{
  "title": string,
  "dek": string,
  "body": string,
  "category": string,
  "tags": string[],
  "hero_gradient": string
}`;

async function generateOne(item: WireItem): Promise<GeneratedExplainer> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const userPrompt = `Write an explainer grounded in this real news item:

Headline: ${item.title}
Outlet: ${item.source}
URL: ${item.url}
Published: ${item.publishedAt}
Summary: ${item.description}

Explain the background, why it matters, who is affected, and what to watch next. Cite the outlet by name in the body where relevant.`;

  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
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
  const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("Empty AI response");
  let parsed: GeneratedExplainer;
  try {
    parsed = JSON.parse(content);
  } catch {
    const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    parsed = JSON.parse(cleaned);
  }
  if (!parsed?.title || !parsed?.body) throw new Error("AI returned incomplete explainer");
  return parsed;
}

export async function generateExplainersFromWire(limit = 15) {
  const cap = Math.max(1, Math.min(limit, 15));
  const wire = await fetchWire(cap);
  if (!wire.length) throw new Error("No wire items available");

  const { data: existingRows } = await supabaseAdmin.from("articles").select("slug");
  const existing = new Set((existingRows ?? []).map((r) => r.slug));

  const date = todayISO();
  const inserted: string[] = [];
  const errors: { url: string; error: string }[] = [];

  // Sequential to stay under gateway rate limits.
  for (const item of wire) {
    try {
      const g = await generateOne(item);
      const category = CATEGORIES.includes(g.category) ? g.category : "politics";
      const hero = GRADIENTS.includes(g.hero_gradient) ? g.hero_gradient : "civic";
      const base = `explainer-${date}-${slugify(g.title)}`;
      const slug = ensureUniqueSlug(base.slice(0, 100), existing);
      const { error } = await supabaseAdmin.from("articles").insert({
        slug,
        title: g.title,
        dek: g.dek,
        body: g.body,
        article_type: "explainer",
        category,
        tags: normalizeTagsToTopics(g.tags ?? []),
        sources: [{ title: `${item.source}: ${item.title}`, url: item.url }],
        hero_gradient: hero,
        featured: false,
      });
      if (error) {
        errors.push({ url: item.url, error: error.message });
      } else {
        inserted.push(slug);
      }
    } catch (e) {
      errors.push({ url: item.url, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return { attempted: wire.length, inserted: inserted.length, slugs: inserted, errors };
}
