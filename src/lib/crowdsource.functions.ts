import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

/** One turn of the Crowdsource desk conversation. Requires an account. */
export const crowdsourceChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ messages: z.array(messageSchema).min(1).max(40) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { runEditorTurn } = await import("@/lib/crowdsource.server");
    return runEditorTurn(data.messages);
  });

/** Files an accepted pitch to the desk. Requires an account. */
export const submitCrowdsourcePitch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        pitch: z.object({
          title: z.string().min(1),
          summary: z.string().min(1),
          source_url: z.string().nullable(),
          source_outlet: z.string().nullable(),
          topics: z.array(z.string()),
          score: z.number(),
          verdict: z.string(),
        }),
        transcript: z.array(messageSchema).max(40),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("crowdsource_pitches").insert({
      user_id: userId,
      ...data.pitch,
      transcript: data.transcript,
      status: "pending",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** The board: pitches currently in line for the next Crowdsource edition. */
export const listCrowdsourceQueue = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("crowdsource_pitches")
    .select("id, title, summary, source_outlet, source_url, topics, score, status, created_at")
    .eq("status", "pending")
    .order("score", { ascending: false })
    .limit(12);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const triggerCrowdsourceEdition = createServerFn({ method: "POST" }).handler(async () => {
  const { generateCrowdsourceEdition } = await import("@/lib/crowdsource.server");
  return generateCrowdsourceEdition();
});
