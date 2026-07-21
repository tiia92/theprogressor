// Server-only: talks to Lovable AI Gateway and inserts today's edition into the DB.
// Do NOT import this from client/route code. Load inside handlers via dynamic import.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ArticleType } from "@/lib/content-types";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

interface GeneratedArticle {
  type: ArticleType;
  title: string;
  dek: string;
  body: string;
  category: string;
  tags: string[];
  sources: { title: string; url?: string }[];
  hero_gradient: string;
  featured?: boolean;
}

interface GeneratedEdition {
  articles: GeneratedArticle[];
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

const SYSTEM_PROMPT = `You are the AI editor-in-chief of NewSlop, an autonomous progressive daily news publication covering U.S. politics and policy.

Your mission: become the publication that best helps readers understand what happened, why it matters, and what to watch next. You are not chasing scoops — you are the best explainer.

Editorial principles:
- Fact-based, well-sourced, transparent about uncertainty
- Clearly progressive editorial framing: pro-labor, pro-democracy, climate-serious, civil-rights-forward, healthcare-access-forward, skeptical of concentrated corporate and executive power
- Sharply distinguish reporting (News) from interpretation (Analysis) from evergreen background (Explainer) from editorial viewpoint (Opinion)
- Plain, direct language. No jargon. Short paragraphs.
- Every article ends by answering: "What to watch next."
- Cite the kinds of sources a reader could verify (agency reports, court filings, named outlets). Do not fabricate URLs.

Article types you write:
- daily_brief: 350-500 word narrative recap of the day's most important U.S. political story or thread
- morning_headlines: a briefing of 5-7 short items. Format body as markdown with an H2 per headline followed by a 2-3 sentence summary.
- deep_dive: 700-1000 word explainer on a policy area (voting rights, healthcare, labor, housing, immigration, climate, civil rights, Supreme Court, federal legislation, elections). Use H2 subheads. Include a "What to watch next" section.

Categories: politics, labor, climate, healthcare, housing, immigration, civil_rights, courts, elections, economy.
Hero gradients: sunrise, dusk, civic, labor, forest, court. Pick one thematically.

Return ONLY valid JSON matching this exact shape (no prose before or after, no code fences):
{
  "articles": [
    {
      "type": "daily_brief" | "morning_headlines" | "deep_dive",
      "title": string,
      "dek": string,   // one-sentence deck under the headline
      "body": string,  // markdown; use ## for subheads, **bold**, *italics*, - lists, > blockquotes
      "category": string,
      "tags": string[],
      "sources": [{"title": string, "url"?: string}],
      "hero_gradient": string,
      "featured": boolean
    }
  ]
}`;

async function callGateway(userPrompt: string): Promise<GeneratedEdition> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
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
    if (resp.status === 429) throw new Error("AI rate limit — try again in a minute.");
    if (resp.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
    throw new Error(`AI gateway ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("Empty AI response");

  let parsed: GeneratedEdition;
  try {
    parsed = JSON.parse(content);
  } catch {
    // Strip code fences just in case
    const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    parsed = JSON.parse(cleaned);
  }

  if (!parsed?.articles?.length) throw new Error("AI returned no articles");
  return parsed;
}

const CANONICAL_TYPES: ArticleType[] = ["daily_brief", "morning_headlines", "deep_dive"];

function ensureUniqueSlug(base: string, existing: Set<string>) {
  let slug = base;
  let n = 2;
  while (existing.has(slug)) {
    slug = `${base}-${n++}`;
  }
  existing.add(slug);
  return slug;
}

export async function generateTodaysEdition() {
  const date = todayISO();

  const userPrompt = `Generate today's edition for ${date}. Produce exactly three articles in this order:
1) A daily_brief on the single most important U.S. political story or thread you know is ongoing.
2) A morning_headlines briefing with 5-7 items across politics, labor, climate, healthcare, courts, immigration, civil rights, elections, and economy.
3) A deep_dive explainer on a policy area that helps readers understand a bigger picture — voting rights, healthcare access, labor organizing, housing, immigration, climate policy, civil rights, a Supreme Court case, federal legislation, or an election cycle. Pick a topic that is currently relevant and where readers benefit from context.

Ground your writing in real, ongoing U.S. political stories, policy fights, and institutions you know about. Do not invent officials, bills, or court cases. If uncertain about a specific detail, keep the framing general. Mark the daily_brief as featured=true.`;

  const edition = await callGateway(userPrompt);

  // Fetch existing slugs to avoid collisions
  const { data: existingRows } = await supabaseAdmin
    .from("articles")
    .select("slug");
  const existing = new Set((existingRows ?? []).map((r) => r.slug));

  const rows = edition.articles
    .filter((a) => CANONICAL_TYPES.includes(a.type))
    .map((a) => {
      const base = `${a.type.replace(/_/g, "-")}-${date}-${slugify(a.title)}`;
      const slug = ensureUniqueSlug(base.slice(0, 100), existing);
      return {
        slug,
        title: a.title,
        dek: a.dek,
        body: a.body,
        article_type: a.type,
        category: a.category || "politics",
        tags: a.tags ?? [],
        sources: a.sources ?? [],
        hero_gradient: a.hero_gradient || "sunrise",
        featured: !!a.featured,
      };
    });

  if (!rows.length) throw new Error("No canonical articles produced");

  const { error } = await supabaseAdmin.from("articles").insert(rows);
  if (error) throw new Error(`DB insert failed: ${error.message}`);

  return { inserted: rows.length, slugs: rows.map((r) => r.slug) };
}
