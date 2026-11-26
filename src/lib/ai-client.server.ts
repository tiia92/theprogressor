// Server-only: shared chat completion helpers that prefer Groq and automatically
// fall back to Lovable AI Gateway on rate limits, errors, or unusable responses.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const LOVABLE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export const GROQ_UTILITY_MODEL = "openai/gpt-oss-20b";
export const GROQ_LONG_FORM_MODEL = "openai/gpt-oss-120b";
export const LOVABLE_FALLBACK_MODEL = "google/gemini-3-flash-preview";
export const LONG_FORM_TIMEOUT_MS = 90_000;

export interface ChatMessageInput {
  role: string;
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessageInput[];
  groqModel?: string;
  fallbackModel?: string;
  json?: boolean;
  preferGroq?: boolean;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface ChatCompletionResult {
  content: string;
  provider: "groq" | "lovable";
  model: string;
}

interface OpenAICompatResponse {
  choices?: { message?: { content?: string } }[];
}

export function parseJsonContent<T = unknown>(content: string): T {
  try {
    return JSON.parse(content) as T;
  } catch {
    const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    return JSON.parse(cleaned) as T;
  }
}

function hasParseableJson(content: string): boolean {
  try {
    parseJsonContent(content);
    return true;
  } catch {
    return false;
  }
}

export async function chatCompletion(opts: ChatCompletionOptions): Promise<ChatCompletionResult> {
  const {
    messages,
    groqModel = GROQ_UTILITY_MODEL,
    fallbackModel = LOVABLE_FALLBACK_MODEL,
    json = true,
    preferGroq = true,
    timeoutMs = 25_000,
    fetchImpl = fetch,
  } = opts;

  const groqKey = process.env["GROQ_API_KEY"];
  if (preferGroq && groqKey) {
    try {
      const body: Record<string, unknown> = { model: groqModel, messages };
      if (json) body["response_format"] = { type: "json_object" };

      const resp = await fetchImpl(GROQ_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (resp.ok) {
        const data = (await resp.json()) as OpenAICompatResponse;
        const content = data.choices?.[0]?.message?.content ?? "";
        if (content && (!json || hasParseableJson(content))) {
          return { content, provider: "groq", model: groqModel };
        }
        console.warn(
          content
            ? "[ai-client] Groq returned malformed JSON; falling back to Lovable AI Gateway"
            : "[ai-client] Groq returned empty content; falling back to Lovable AI Gateway",
        );
      } else {
        const detail = await resp.text().catch(() => "");
        console.warn(
          `[ai-client] Groq ${resp.status} (${detail.slice(0, 160)}); falling back to Lovable AI Gateway`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[ai-client] Groq request failed (${msg}); falling back to Lovable AI Gateway`);
    }
  }

  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");

  const body: Record<string, unknown> = { model: fallbackModel, messages };
  if (json) body["response_format"] = { type: "json_object" };

  const resp = await fetchImpl(LOVABLE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    if (resp.status === 429) throw new Error("AI rate limit");
    if (resp.status === 402) throw new Error("AI credits exhausted");
    throw new Error(`AI gateway ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = (await resp.json()) as OpenAICompatResponse;
  const content = data.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("Empty AI response");
  return { content, provider: "lovable", model: fallbackModel };
}

/** Long-form writing uses Groq's larger model; prompts and output contracts stay caller-owned. */
export function longFormCompletion(
  opts: Pick<ChatCompletionOptions, "messages" | "json" | "fetchImpl">,
): Promise<ChatCompletionResult> {
  return chatCompletion({
    ...opts,
    groqModel: GROQ_LONG_FORM_MODEL,
    fallbackModel: LOVABLE_FALLBACK_MODEL,
    timeoutMs: LONG_FORM_TIMEOUT_MS,
  });
}
