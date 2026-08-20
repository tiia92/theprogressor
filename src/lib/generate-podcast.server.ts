// Server-only: writes, voices, and publishes the weekly Progressor podcast.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chunkForNarration, plainTextForNarration } from "@/lib/narration-text";
import {
  HOST_SYSTEM_PROMPT,
  HOST_VOICE,
  HOST_VOICE_INSTRUCTIONS,
} from "@/lib/podcast-persona";

const CHAT_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const TTS_URL = "https://ai.gateway.lovable.dev/v1/audio/speech";
const MODEL = "google/gemini-3-flash-preview";
const BUCKET = "podcast";

export interface Chapter {
  title: string;
  summary: string;
}

function weekStartISO(d = new Date()) {
  const date = new Date(d);
  const day = date.getUTCDay(); // 0 = Sunday
  date.setUTCDate(date.getUTCDate() - day);
  return date.toISOString().slice(0, 10);
}

function apiKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  return key;
}

async function chat(messages: { role: string; content: string }[], json = false) {
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI gateway failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI gateway returned no content");
  return content;
}

async function speak(text: string): Promise<Uint8Array> {
  const res = await fetch(TTS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini-tts",
      input: text,
      voice: HOST_VOICE,
      response_format: "mp3",
      instructions: HOST_VOICE_INSTRUCTIONS,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TTS failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

export interface GenerateEpisodeOptions {
  publish?: boolean;
  /** ISO date (YYYY-MM-DD) the episode's week starts on. Defaults to this week. */
  weekStart?: string;
  /** ISO date (YYYY-MM-DD) the coverage window ends on, inclusive. */
  weekEnd?: string;
  /** Extra instruction appended to the writing prompt (e.g. "expand on the sample"). */
  extraDirection?: string;
  /** Slug suffix so a second take of the same week gets its own episode. */
  slugSuffix?: string;
}

/** Generate the episode for a week of coverage. Returns the episode slug. */
export async function generateWeeklyEpisode(options: GenerateEpisodeOptions = {}) {
  const week = options.weekStart ?? weekStartISO();
  const since = `${week}T00:00:00Z`;
  const until = options.weekEnd
    ? `${options.weekEnd}T23:59:59Z`
    : new Date(new Date(since).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: articles, error } = await supabaseAdmin
    .from("articles")
    .select("title, dek, body, article_type, category, published_at")
    .gte("published_at", since)
    .lte("published_at", until)
    .order("published_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  if (!articles?.length) throw new Error("No articles published in that week");

  const { data: sponsors } = await supabaseAdmin
    .from("sponsors")
    .select("name, copy, link, active, starts_on, ends_on, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  const today = new Date().toISOString().slice(0, 10);
  const activeSponsors = (sponsors ?? []).filter(
    (s) => (!s.starts_on || s.starts_on <= today) && (!s.ends_on || s.ends_on >= today),
  );

  const digest = articles
    .map(
      (a) =>
        `[${a.article_type}] ${a.title}\n${a.dek ?? ""}\n${(a.body ?? "").slice(0, 900)}`,
    )
    .join("\n\n---\n\n");

  const sponsorBlock = activeSponsors.length
    ? activeSponsors
        .map((s) => `- ${s.name}: ${s.copy}${s.link ? ` (${s.link})` : ""}`)
        .join("\n")
    : "(no sponsors this week)";

  const context = `${
    options.extraDirection ? `EXTRA DIRECTION:\n${options.extraDirection}\n\n` : ""
  }SPONSORS TO READ:\n${sponsorBlock}\n\nTHIS WEEK'S COVERAGE (${week} to ${
    options.weekEnd ?? "end of week"
  }):\n${digest}`;

  // Long-form scripts come out short in one shot, so outline first, then write
  // each section separately and stitch them into the full episode.
  const outlineRaw = await chat(
    [
      { role: "system", content: HOST_SYSTEM_PROMPT },
      {
        role: "user",
        content: `${context}\n\nPlan this week's 25-minute episode. Return JSON only: {"sections":[{"kind":"cold_open"|"intro"|"sponsors"|"segment"|"explainer"|"close","title":string,"beats":string}]} in running order: cold open, AI-disclosure intro, sponsor read, 4 story segments, one explainer detour, close. "beats" lists the specific facts, names and sources that section must cover, drawn from the coverage above.`,
      },
    ],
    true,
  );

  interface Section {
    kind: string;
    title: string;
    beats: string;
  }
  let sections: Section[] = [];
  try {
    sections = (JSON.parse(outlineRaw) as { sections?: Section[] }).sections ?? [];
  } catch {
    console.error("[podcast] outline parse failed");
  }
  if (!sections.length) {
    sections = [{ kind: "segment", title: "This week", beats: "The week's biggest stories." }];
  }

  const targets: Record<string, number> = {
    cold_open: 150,
    intro: 200,
    sponsors: 150,
    segment: 750,
    explainer: 450,
    close: 200,
  };

  const written: string[] = [];
  for (const section of sections.slice(0, 10)) {
    const target = targets[section.kind] ?? 600;
    const previous = written.slice(-1)[0]?.slice(-1200) ?? "(this is the opening of the episode)";
    const part = await chat([
      { role: "system", content: HOST_SYSTEM_PROMPT },
      {
        role: "user",
        content: `${context}\n\nYou are writing ONE section of this week's episode, in order.\n\nSECTION: ${section.kind} — ${section.title}\nMUST COVER: ${section.beats}\n\nThe previous section ended with:\n"""${previous}"""\n\nWrite roughly ${target} words of spoken script for this section only. No headings, no stage directions, no section labels — only the words the host says. Do not re-introduce the show unless this is the intro, and do not sign off unless this is the close.`,
      },
    ]);
    written.push(part.trim());
  }

  const script = written.join("\n\n");

  const metaRaw = await chat(
    [
      {
        role: "system",
        content:
          'Return JSON only: {"title": string (max 70 chars, no quotes), "summary": string (2-3 sentences), "chapters": [{"title": string, "summary": string}]} describing this podcast episode. 4-7 chapters in running order.',
      },
      { role: "user", content: script.slice(0, 18000) },
    ],
    true,
  );

  let title = `The Progressor Podcast — week of ${week}`;
  let summary = "";
  let chapters: Chapter[] = [];
  try {
    const parsed = JSON.parse(metaRaw) as {
      title?: string;
      summary?: string;
      chapters?: Chapter[];
    };
    if (parsed.title) title = parsed.title.slice(0, 90);
    if (parsed.summary) summary = parsed.summary;
    if (Array.isArray(parsed.chapters)) chapters = parsed.chapters.slice(0, 8);
  } catch {
    console.error("[podcast] metadata parse failed");
  }

  // Voice the script chunk by chunk, then stitch the MP3 pieces together.
  const spoken = plainTextForNarration(script, null, null);
  const chunks = chunkForNarration(spoken, 300);
  const parts: Uint8Array[] = [];
  for (const chunk of chunks) {
    parts.push(await speak(chunk));
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const audio = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    audio.set(p, offset);
    offset += p.length;
  }

  const slug = `week-of-${week}${options.slugSuffix ? `-${options.slugSuffix}` : ""}`;
  const path = `${slug}.mp3`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, audio, { contentType: "audio/mpeg", upsert: true });
  if (uploadError) throw new Error(`Audio upload failed: ${uploadError.message}`);

  const words = (spoken.match(/\S+/g) ?? []).length;
  const duration = Math.round((words / 150) * 60);
  const publish = options.publish ?? true;

  const { error: saveError } = await supabaseAdmin.from("podcast_episodes").upsert(
    {
      slug,
      title,
      summary,
      script,
      chapters: chapters as unknown as never,
      audio_path: path,
      duration_seconds: duration,
      week_start: week,
      status: publish ? "published" : "draft",
      published_at: publish ? new Date().toISOString() : null,
    },
    { onConflict: "slug" },
  );
  if (saveError) throw new Error(saveError.message);

  return { slug, title, chunks: chunks.length, durationSeconds: duration, status: publish ? "published" : "draft" };
}
