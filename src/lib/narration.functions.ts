import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chunkForNarration, plainTextForNarration } from "@/lib/narration-text";

/** Narrate one chunk of an article. Pro-only. */
export const narrateArticleChunk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string().min(1), chunk: z.number().int().min(0).max(50) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: subs } = await supabase
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", userId);

    const isPro = (subs ?? []).some((s) => {
      const future = !s.current_period_end || new Date(s.current_period_end) > new Date();
      return ["active", "trialing", "past_due", "canceled"].includes(s.status) && future;
    });
    if (!isPro) {
      return { error: "Audio narration is a Pro feature." as const };
    }

    const { data: article, error } = await supabase
      .from("articles")
      .select("title, dek, body")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!article) return { error: "Article not found." };

    const text = plainTextForNarration(article.title, article.dek, article.body);
    const chunks = chunkForNarration(text);
    if (data.chunk >= chunks.length) return { error: "No such chunk." };

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "Narration is not configured." };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini-tts",
        input: chunks[data.chunk],
        voice: "alloy",
        response_format: "mp3",
        instructions:
          "Read like a calm, clear public-radio news anchor. Measured pace, natural phrasing.",
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[narration] TTS failed [${res.status}]: ${body}`);
      if (res.status === 429) return { error: "Too many requests — try again in a moment." };
      if (res.status === 402) return { error: "Narration credits are exhausted." };
      return { error: `Narration failed (${res.status}).` };
    }

    const audio = Buffer.from(await res.arrayBuffer()).toString("base64");
    return { audio, total: chunks.length };
  });
