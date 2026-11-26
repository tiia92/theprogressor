import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  chatCompletion,
  GROQ_LONG_FORM_MODEL,
  GROQ_UTILITY_MODEL,
  longFormCompletion,
  LOVABLE_FALLBACK_MODEL,
} from "./ai-client.server";

describe("chatCompletion Groq-first with Lovable fallback", () => {
  const origGroq = process.env["GROQ_API_KEY"];
  const origLovable = process.env["LOVABLE_API_KEY"];

  beforeEach(() => {
    process.env["GROQ_API_KEY"] = "test-groq-key";
    process.env["LOVABLE_API_KEY"] = "test-lovable-key";
  });

  afterEach(() => {
    if (origGroq === undefined) delete process.env["GROQ_API_KEY"];
    else process.env["GROQ_API_KEY"] = origGroq;
    if (origLovable === undefined) delete process.env["LOVABLE_API_KEY"];
    else process.env["LOVABLE_API_KEY"] = origLovable;
    vi.restoreAllMocks();
  });

  it("uses Groq first when GROQ_API_KEY is set", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), {
        status: 200,
      }),
    );

    const res = await chatCompletion({
      messages: [{ role: "user", content: "hi" }],
      fetchImpl: fetchMock,
    });

    expect(res.provider).toBe("groq");
    expect(res.model).toBe(GROQ_UTILITY_MODEL);
    expect(res.content).toBe('{"ok":true}');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("api.groq.com");
  });

  it("falls back to Lovable AI Gateway when Groq returns 429", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: '{"fallback":true}' } }] }), {
          status: 200,
        }),
      );

    const res = await chatCompletion({
      messages: [{ role: "user", content: "hi" }],
      fetchImpl: fetchMock,
    });

    expect(res.provider).toBe("lovable");
    expect(res.model).toBe(LOVABLE_FALLBACK_MODEL);
    expect(res.content).toBe('{"fallback":true}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("ai.gateway.lovable.dev");
  });

  it("falls back to Lovable AI Gateway when GROQ_API_KEY is missing", async () => {
    delete process.env["GROQ_API_KEY"];
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), {
        status: 200,
      }),
    );

    const res = await chatCompletion({
      messages: [{ role: "user", content: "hi" }],
      fetchImpl: fetchMock,
    });

    expect(res.provider).toBe("lovable");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("ai.gateway.lovable.dev");
  });

  it("uses Groq's larger model for long-form writing without changing messages or adding output caps", async () => {
    const messages = [
      { role: "system", content: "Write the requested article." },
      { role: "user", content: "Use the supplied source." },
    ];
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: { content: "Article text" } }] }), {
        status: 200,
      }),
    );

    const res = await longFormCompletion({ messages, json: false, fetchImpl: fetchMock });

    expect(res).toEqual({ content: "Article text", provider: "groq", model: GROQ_LONG_FORM_MODEL });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(request).toEqual({ model: "openai/gpt-oss-120b", messages });
  });

  it("falls back instead of accepting malformed JSON from Groq", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: "not json" } }] }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), {
          status: 200,
        }),
      );

    const res = await longFormCompletion({
      messages: [{ role: "user", content: "Return JSON." }],
      fetchImpl: fetchMock,
    });

    expect(res.provider).toBe("lovable");
    expect(res.content).toBe('{"ok":true}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});