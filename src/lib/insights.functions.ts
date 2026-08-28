import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createPublicSupabaseClient } from "@/lib/supabase-public.server";

const REPORT_COLUMNS =
  "id, slug, week_start, week_end, title, summary, synthesis, confirmed, disputed, allegations, unknowns, prior_context, stories, sources, article_count, published_at";

export const getLatestInsightReport = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase
    .from("insight_reports")
    .select(REPORT_COLUMNS)
    .eq("status", "published")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
});

export const listInsightReports = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase
    .from("insight_reports")
    .select("slug, week_start, week_end, title, summary")
    .eq("status", "published")
    .order("week_start", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getClaimMix = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ weekStart: z.string().optional() }).parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const { claimMix } = await import("@/lib/clickhouse.server");
    return claimMix(data.weekStart);
  });

export const triggerInsightsGeneration = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ weekStart: z.string().optional(), weekEnd: z.string().optional() }).parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const { generateInsightsReport } = await import("@/lib/generate-insights.server");
    return generateInsightsReport(data);
  });
