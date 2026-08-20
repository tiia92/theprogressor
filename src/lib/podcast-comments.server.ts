// Server-only: screens listener feedback before it becomes public.
const CHAT_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

export interface Moderation {
  allowed: boolean;
  score: number;
  reason: string;
}

const SYSTEM = `You screen listener comments on a news podcast.

Return JSON only: {"allowed": boolean, "score": number, "reason": string}

allowed = false when the comment contains harassment, slurs, hate, threats, sexual content, doxxing, spam/advertising, or is pure abuse with no substance. Strong criticism of the show, the host, or politicians and their policies is ALLOWED.
score = 0-100 for how worth featuring the comment is: specific, substantive, adds information, asks a good question, or is genuinely funny scores high; "great episode" scores low.
reason = one short sentence.`;

export async function moderateComment(body: string): Promise<Moderation> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");

  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: body.slice(0, 4000) },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Moderation failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(content) as Partial<Moderation>;
    return {
      allowed: parsed.allowed !== false,
      score: Math.max(0, Math.min(100, Math.round(Number(parsed.score ?? 50)))),
      reason: String(parsed.reason ?? "").slice(0, 300),
    };
  } catch {
    return { allowed: true, score: 50, reason: "Automatic review was inconclusive." };
  }
}
