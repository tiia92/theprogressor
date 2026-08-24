// Server-only: classify every article's title+dek into canonical topic slugs
// using the Lovable AI Gateway, and write them back into `articles.tags`.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TOPICS, TOPIC_SLUGS, normalizeTagsToTopics } from "@/lib/content-types";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const TAXONOMY_LIST = TOPICS.map((t) => `- ${t.slug}: ${t.label} — ${t.description}`).join("\n");

const SYSTEM_PROMPT = `You are a librarian classifying news articles into a fixed topic taxonomy for a progressive daily explainer.

TAXONOMY (use these slugs, and ONLY these slugs):
${TAXONOMY_LIST}

Rules:
- Pick 1 to 4 slugs that best describe the article's subject matter.
- Prefer the most specific topics. Only include broad ones (like us_politics) when they genuinely apply.
- Do NOT invent new slugs. Do NOT include labels — return slugs exactly as written above.
- Never include sports unless the article is genuinely about sports.

Return ONLY valid JSON: {"topics": string[]}`;

async function classifyOne(title: string, dek: string, category: string): Promise<string[]> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const userPrompt = `Article:
Title: ${title}
Dek: ${dek}
Section hint: ${category}

Return the best 1–4 topic slugs.`;

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
  let parsed: { topics?: unknown };
  try {
    parsed = JSON.parse(content);
  } catch {
    const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    parsed = JSON.parse(cleaned);
  }
  const list = Array.isArray(parsed?.topics) ? (parsed.topics as unknown[]) : [];
  const valid = list
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => (TOPIC_SLUGS as readonly string[]).includes(s));
  return Array.from(new Set(valid)).slice(0, 4);
}

export async function backfillArticleTopics(opts: { onlyMissing?: boolean; force?: boolean } = {}) {
  const { onlyMissing = false, force = true } = opts;
  const { data: rows, error } = await supabaseAdmin
    .from("articles")
    .select("id, title, dek, category, tags");
  if (error) throw new Error(error.message);
  const all = rows ?? [];

  let updated = 0;
  const errors: { id: string; error: string }[] = [];

  for (const row of all) {
    // Try alias-based normalization first — cheap and offline.
    const aliased = normalizeTagsToTopics(row.tags ?? []);
    let topics: string[] = aliased;

    // If alias mapping didn't yield enough coverage, ask the model.
    const needsAI = onlyMissing ? topics.length === 0 : topics.length < 2;
    if (needsAI) {
      try {
        const classified = await classifyOne(row.title, row.dek, row.category);
        topics = Array.from(new Set([...classified, ...aliased])).slice(0, 4);
      } catch (e) {
        errors.push({ id: row.id, error: e instanceof Error ? e.message : String(e) });
        // Fall back to alias-only tags if the AI call fails.
      }
    }

    // Always include category itself if it maps to a topic and we have space.
    const catTopics = normalizeTagsToTopics([row.category]);
    for (const t of catTopics) {
      if (topics.length >= 4) break;
      if (!topics.includes(t)) topics.push(t);
    }

    const { error: upErr } = await supabaseAdmin
      .from("articles")
      .update({ tags: topics })
      .eq("id", row.id);
    if (upErr) {
      errors.push({ id: row.id, error: upErr.message });
    } else {
      updated += 1;
    }
  }

  return { scanned: all.length, updated, errors };
}
