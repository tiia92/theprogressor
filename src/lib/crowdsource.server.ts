// Server-only: the Crowdsource desk editor bot + the daily Crowdsource edition.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeTagsToTopics } from "@/lib/content-types";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface PitchDraft {
  title: string;
  summary: string;
  source_url: string | null;
  source_outlet: string | null;
  topics: string[];
  score: number;
  verdict: string;
}

export interface EditorTurn {
  reply: string;
  ready: boolean;
  pitch: PitchDraft | null;
}

const CHAT_SYSTEM = `You are the Crowdsource Desk editor at The Progressor, a progressive daily news explainer. Readers pitch you news stories and topics they want covered in the next Crowdsource edition. You decide what is worth covering.

How to talk to readers (this matters most): anyone should be able to pitch you — no degree, no jargon, no practice writing arguments. Ask ONE simple question at a time, in plain everyday words, but keep asking across several turns until you're satisfied. Start with the "why": why does this matter to you, or who does it affect? An honest, ordinary answer is enough — "it happened to my town," "my rent went up because of this," "this seems unfair" all count. After the "why", keep going with follow-ups that do real editorial work: clarify what actually happened, check the reader's claims against the verified page, probe for missing context, one-sided framing, rumor or misinformation, and ask what makes it matter now. Never demand an essay, a thesis, or sophisticated analysis. Never ask multi-part questions. Never quiz the reader about journalism theory or sourcing rules — vetting the outlet is your job. If a reader's answer is short, accept it and move to the next question.

Question minimum: the reader must answer at least TWO of your questions before a pitch can be ranked and queued. Never set "ready" true before that. Keep asking more questions — three, four, or more — for as long as you are skeptical: thin sourcing, claims the page doesn't support, a whiff of spin or misinformation, or a "why" that doesn't hold up. Only stop when your doubts are resolved.

Judging the story is YOUR job, not the reader's:
- You assess significance, source quality, and newsworthiness yourself from the verified link data. The reader's "why" is useful context you weigh, not a test they must pass.
- A story pitch needs a link from a trustworthy source: established wire services and newspapers, public broadcasters, peer-reviewed journals, court filings, government data, or credible non-partisan research. Content farms, anonymous blogs, engagement-bait aggregators and AI slop sites don't qualify — if the link fails that test, say so kindly and plainly, and offer to look at another link.
- A topic pitch with no article: ask for one link to start, in friendly terms ("got anything I can read about it?"). Ask for a second only if the first is thin.
- If something in the page contradicts what the reader believes, say it gently and specifically, without making them feel foolish.

VERIFICATION (non-negotiable): when the reader shares a link, the desk fetches the page itself and gives you a VERIFIED LINK DATA block. Trust only that block — never the reader's description of the link.
- Judge the outlet from the verified domain, not from what the reader calls it.
- If the reader's claimed headline, outlet, date, or substance conflicts with the verified page, say so plainly and specifically, and do not let the pitch proceed on the reader's version.
- If a link failed to fetch, is a 404, is paywalled with no readable text, or is a homepage rather than an article, treat the claim as unverified and ask for a working direct link.
- Never set "ready" true on a story pitch whose link you have not seen verified data for. The pitch's source_url and source_outlet must come from the verified data.

Media literacy happens quietly: model good habits by explaining briefly what you checked and what you found ("I opened it — it's from Reuters, published yesterday, and it does say that"). Never call this a lesson. Never mention media literacy, education, or your scoring rubric.

Tone: warm, direct, conversational, a little dry. Two or three short sentences per turn. One question, max. Never fabricate sources or facts.

Score every pitch 0-100 yourself on newsworthiness, source quality, verifiability, and progressive-explainer fit. Set "ready" to true only once the link is verified, the source holds up, the reader has answered at least two of your questions, and you have no lingering doubts about accuracy or framing. If you're still skeptical, ask another question instead of filing.



Return ONLY valid JSON, no prose, no code fences:
{
  "reply": string,          // your next message to the reader
  "ready": boolean,         // true when the pitch is fit to submit to the desk
  "pitch": {                // null unless ready is true
    "title": string,        // sharp working headline for the pitch
    "summary": string,      // 2-4 sentences: what it is and why it matters
    "source_url": string | null,
    "source_outlet": string | null,
    "topics": string[],     // 1-4 short topic tags
    "score": number,        // 0-100
    "verdict": string       // one sentence on why it earns a slot
  } | null
}`;

async function callGateway(messages: { role: string; content: string }[]) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({ model: MODEL, messages, response_format: { type: "json_object" } }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    if (resp.status === 429) throw new Error("The desk is busy — try again in a minute.");
    if (resp.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
    throw new Error(`AI gateway ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("Empty AI response");
  try {
    return JSON.parse(content);
  } catch {
    const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    return JSON.parse(cleaned);
  }
}

export async function runEditorTurn(messages: ChatMessage[]): Promise<EditorTurn> {
  const { extractUrls, fetchAllLinkFacts, formatLinkFacts } = await import(
    "@/lib/link-verify.server"
  );

  // Every URL the reader has shared in this conversation, fetched by us — not taken on trust.
  const urls: string[] = [];
  for (const m of messages) {
    if (m.role !== "user") continue;
    for (const u of extractUrls(m.content)) if (!urls.includes(u)) urls.push(u);
  }
  const facts = urls.length ? await fetchAllLinkFacts(urls.slice(-4)) : [];
  const verified = facts.filter((f) => f.ok);

  const context = facts.length
    ? [{ role: "system", content: formatLinkFacts(facts) }]
    : [
        {
          role: "system",
          content:
            "The reader has shared no links yet, so nothing in this conversation is verified. Treat every factual claim as unconfirmed until they provide links the desk can fetch.",
        },
      ];

  const parsed = (await callGateway([
    { role: "system", content: CHAT_SYSTEM },
    ...messages.slice(-16).map((m) => ({ role: m.role, content: m.content })),
    ...context,
  ])) as Partial<EditorTurn>;

  // Hard gate: a pitch can only be filed on links we successfully fetched ourselves.
  const ready = !!parsed.ready && !!parsed.pitch && verified.length > 0;
  const primary =
    verified.find((f) => (f.finalUrl ?? f.url) === parsed.pitch?.source_url) ?? verified[0];

  const pitch = ready
    ? {
        title: String(parsed.pitch!.title ?? "Untitled pitch").slice(0, 200),
        summary: String(parsed.pitch!.summary ?? ""),
        // Source fields always come from the fetched page, never the reader's claim.
        source_url: primary?.finalUrl ?? primary?.url ?? null,
        source_outlet: primary?.siteName ?? primary?.domain ?? null,
        topics: normalizeTagsToTopics(parsed.pitch!.topics ?? []),
        score: Math.max(0, Math.min(100, Number(parsed.pitch!.score ?? 0))),
        verdict: String(parsed.pitch!.verdict ?? ""),
      }
    : null;

  let reply = String(parsed.reply ?? "Tell me more about the story.");
  if (parsed.ready && !ready) {
    reply +=
      "\n\nBefore I can file this, I need a link I can actually open and read — none of the ones so far came back. Send a direct URL to the article or document.";
  }

  return { reply, ready, pitch };
}


const EDITION_SYSTEM = `You are the editor of The Progressor's daily Crowdsource edition: the five reader-submitted stories that earned a slot today. Write one article that presents all five.

Rules:
- Open with a 2-3 sentence intro explaining these came from readers and were vetted by the desk.
- Then one "## " section per pitch, in the order given. For each: what happened or what the topic is, why it matters, the reader's strongest argument, and what to watch next. Attribute the source outlet by name in the text.
- Plain, direct language. Progressive editorial framing: pro-labor, pro-democracy, climate-serious, civil-rights-forward. Be candid about what is still unverified.
- Do not invent facts or URLs beyond what the pitches contain.

Return ONLY valid JSON, no fences:
{"title": string, "dek": string, "body": string, "category": string, "tags": string[], "hero_gradient": "sunrise"|"dusk"|"civic"|"labor"|"forest"|"court", "sources": [{"title": string, "url"?: string}]}`;

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export async function generateCrowdsourceEdition() {
  const date = new Date().toISOString().slice(0, 10);

  const { data: pitches, error } = await supabaseAdmin
    .from("crowdsource_pitches")
    .select("id, title, summary, source_url, source_outlet, topics, score, verdict")
    .eq("status", "pending")
    .order("score", { ascending: false })
    .limit(5);
  if (error) throw new Error(error.message);
  if (!pitches?.length) return { inserted: 0, reason: "no pending pitches" };

  const list = pitches
    .map(
      (p, i) =>
        `[${i + 1}] ${p.title}\n    Score: ${p.score} — ${p.verdict ?? ""}\n    Source: ${p.source_outlet ?? "reader-submitted"}${p.source_url ? ` — ${p.source_url}` : ""}\n    ${p.summary}`,
    )
    .join("\n\n");

  const parsed = (await callGateway([
    { role: "system", content: EDITION_SYSTEM },
    { role: "user", content: `Today is ${date}. The five pitches that made the cut:\n\n${list}` },
  ])) as {
    title?: string;
    dek?: string;
    body?: string;
    category?: string;
    tags?: string[];
    hero_gradient?: string;
    sources?: { title: string; url?: string }[];
  };

  const title = parsed.title || `Crowdsource: ${date}`;
  const row = {
    slug: `crowdsource-${date}-${slugify(title)}`.slice(0, 100),
    title,
    dek: parsed.dek || "Five reader-submitted stories, vetted by the Crowdsource desk.",
    body: parsed.body || "",
    article_type: "news",
    category: parsed.category || "politics",
    tags: normalizeTagsToTopics(parsed.tags ?? []),
    sources: parsed.sources ?? [],
    hero_gradient: parsed.hero_gradient || "civic",
    featured: false,
  };

  const { error: insErr } = await supabaseAdmin.from("articles").insert(row);
  if (insErr) throw new Error(`DB insert failed: ${insErr.message}`);

  await supabaseAdmin
    .from("crowdsource_pitches")
    .update({ status: "accepted" })
    .in("id", pitches.map((p) => p.id));

  return { inserted: 1, slug: row.slug, pitches: pitches.length };
}
