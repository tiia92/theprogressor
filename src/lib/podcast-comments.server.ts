// Server-only: screens listener feedback before it becomes public.
import { chatCompletion, parseJsonContent } from "@/lib/ai-client.server";

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
  const { content } = await chatCompletion({
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: body.slice(0, 4000) },
    ],
    json: true,
  });
  try {
    const parsed = parseJsonContent<Partial<Moderation>>(content);
    return {
      allowed: parsed.allowed !== false,
      score: Math.max(0, Math.min(100, Math.round(Number(parsed.score ?? 50)))),
      reason: String(parsed.reason ?? "").slice(0, 300),
    };
  } catch {
    return { allowed: true, score: 50, reason: "Automatic review was inconclusive." };
  }
}
