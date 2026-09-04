// Server-only: bounded, resumable backfill of 2023-to-today news metadata
// from GDELT's free document API into public.news_archive.
//
// Safety rules (see the background-job conventions used elsewhere here):
//   - one lease row, so only one run works at a time
//   - a hard cap on windows processed per run
//   - per-window progress recorded in the DB, so re-runs skip finished work
//   - halts and reports instead of looping when the source throttles or errors

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { storeArchiveItems, type ArchiveItem } from "@/lib/news-archive.server";

const JOB = "archive-backfill";
const LEASE_MS = 5 * 60_000;
const ARCHIVE_START = "2023-01-01";
const GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc";
const MAX_ATTEMPTS = 4;

/** topic slug -> GDELT query */
const TOPIC_QUERIES: Record<string, string> = {
  politics: '("white house" OR congress OR senate OR "house of representatives")',
  elections: '("election" OR "voting rights" OR "ballot" OR "redistricting")',
  courts: '("supreme court" OR "federal judge" OR "lawsuit" OR "indictment")',
  labor: '("labor union" OR strike OR "collective bargaining" OR "minimum wage")',
  climate: '("climate change" OR "clean energy" OR "emissions" OR "extreme weather")',
  healthcare: '("medicaid" OR "medicare" OR "affordable care act" OR "health insurance")',
  housing: '("affordable housing" OR "rent" OR "eviction" OR "homelessness")',
  immigration: '("immigration" OR "border" OR "asylum" OR "deportation")',
  civil_rights: '("civil rights" OR "discrimination" OR "police reform" OR "lgbtq")',
  economy: '("inflation" OR "federal reserve" OR "tariffs" OR "unemployment")',
};

const GDELT_SUFFIX = "sourcecountry:US sourcelang:english";

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function monthsFrom(startISO: string): string[] {
  const out: string[] = [];
  const now = new Date();
  const cursor = new Date(`${startISO}T00:00:00Z`);
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  while (cursor <= end) {
    out.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return out;
}

function gdeltStamp(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z").replace("T", "T");
}

function parseSeenDate(s: string) {
  // "20230301T120000Z"
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s ?? "");
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
}

// ---------- lease ----------

async function ensureLeaseRow() {
  await supabaseAdmin
    .from("job_leases")
    .upsert({ job_name: JOB, locked_until: new Date(0).toISOString() }, { onConflict: "job_name", ignoreDuplicates: true });
}

async function readLease() {
  const { data } = await supabaseAdmin
    .from("job_leases")
    .select("paused, pause_reason, locked_until")
    .eq("job_name", JOB)
    .maybeSingle();
  return data;
}

async function acquireLease() {
  await ensureLeaseRow();
  const now = new Date().toISOString();
  const { data } = await supabaseAdmin
    .from("job_leases")
    .update({ locked_until: new Date(Date.now() + LEASE_MS).toISOString() })
    .eq("job_name", JOB)
    .lt("locked_until", now)
    .select("job_name")
    .maybeSingle();
  return !!data;
}

async function releaseLease() {
  await supabaseAdmin
    .from("job_leases")
    .update({ locked_until: new Date(0).toISOString() })
    .eq("job_name", JOB);
}

async function pauseJob(reason: string) {
  await supabaseAdmin.from("job_leases").update({ paused: true, pause_reason: reason }).eq("job_name", JOB);
}

export async function resumeBackfill() {
  await ensureLeaseRow();
  await supabaseAdmin
    .from("job_leases")
    .update({ paused: false, pause_reason: null, locked_until: new Date(0).toISOString() })
    .eq("job_name", JOB);
  return { paused: false };
}

// ---------- windows ----------

export async function seedBackfillWindows() {
  const months = monthsFrom(ARCHIVE_START);
  const rows = months.flatMap((month) =>
    Object.keys(TOPIC_QUERIES).map((topic) => ({
      window_key: `${month}:${topic}`,
      month_start: month,
      topic,
    })),
  );
  const { error } = await supabaseAdmin
    .from("archive_backfill_windows")
    .upsert(rows, { onConflict: "window_key", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  return rows.length;
}

export async function backfillProgress() {
  const [{ count: total }, { count: done }, { count: failed }, lease] = await Promise.all([
    supabaseAdmin.from("archive_backfill_windows").select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("archive_backfill_windows")
      .select("id", { count: "exact", head: true })
      .eq("status", "done"),
    supabaseAdmin
      .from("archive_backfill_windows")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
    readLease(),
  ]);
  const { count: rows } = await supabaseAdmin
    .from("news_archive")
    .select("id", { count: "exact", head: true });
  return {
    total: total ?? 0,
    done: done ?? 0,
    failed: failed ?? 0,
    remaining: Math.max(0, (total ?? 0) - (done ?? 0) - (failed ?? 0)),
    archived_rows: rows ?? 0,
    paused: !!lease?.paused,
    pause_reason: lease?.pause_reason ?? null,
  };
}

// ---------- source ----------

class ThrottledError extends Error {}

async function fetchGdeltWindow(topic: string, monthStart: string): Promise<ArchiveItem[]> {
  const start = new Date(`${monthStart}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const now = new Date();
  const to = end > now ? now : end;

  const url = new URL(GDELT_URL);
  url.searchParams.set("query", `${TOPIC_QUERIES[topic]} ${GDELT_SUFFIX}`);
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", "250");
  url.searchParams.set("sort", "hybridrel");
  url.searchParams.set("startdatetime", gdeltStamp(start).replace(/[TZ]/g, "").slice(0, 14));
  url.searchParams.set("enddatetime", gdeltStamp(to).replace(/[TZ]/g, "").slice(0, 14));

  const resp = await fetch(url.toString(), {
    headers: { "User-Agent": "TheProgressor/1.0 (+https://theprogressor.lovable.app)" },
  });
  const text = await resp.text();

  if (resp.status === 429 || /please limit requests|rate limit/i.test(text.slice(0, 300))) {
    throw new ThrottledError("GDELT is throttling requests");
  }
  if (!resp.ok) throw new Error(`GDELT ${resp.status}: ${text.slice(0, 200)}`);

  if (!text.trim()) return [];

  let data: { articles?: { url?: string; title?: string; domain?: string; seendate?: string }[] };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`GDELT returned non-JSON: ${text.slice(0, 200)}`);
  }

  return (data.articles ?? [])
    .filter((a) => a.url && a.title)
    .map((a) => ({
      url: a.url!,
      title: a.title!,
      outlet: a.domain ?? "",
      publishedAt: parseSeenDate(a.seendate ?? "") ?? `${monthStart}T12:00:00Z`,
      topics: [topic],
      source: "gdelt",
    }));
}

// ---------- run ----------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runArchiveBackfill(opts: { maxWindows?: number } = {}) {
  const maxWindows = Math.max(1, Math.min(opts.maxWindows ?? 3, 8));

  await seedBackfillWindows();

  const lease = await readLease();
  if (lease?.paused) {
    return { skipped: "paused" as const, reason: lease.pause_reason, ...(await backfillProgress()) };
  }

  if (!(await acquireLease())) {
    return { skipped: "locked" as const, ...(await backfillProgress()) };
  }

  let processed = 0;
  let stored = 0;
  let throttled = false;

  try {
    for (let i = 0; i < maxWindows; i++) {
      const { data: next } = await supabaseAdmin
        .from("archive_backfill_windows")
        .select("id, window_key, month_start, topic, attempts")
        .in("status", ["pending", "error"])
        .lt("attempts", MAX_ATTEMPTS)
        .order("month_start", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!next) break;

      // claim it
      await supabaseAdmin
        .from("archive_backfill_windows")
        .update({ status: "running", attempts: (next.attempts ?? 0) + 1 })
        .eq("id", next.id);

      try {
        if (i > 0) await sleep(10_000); // GDELT asks for >=5s between requests
        const items = await fetchGdeltWindow(next.topic, next.month_start);
        const n = await storeArchiveItems(items, "gdelt");
        stored += n;
        processed += 1;
        await supabaseAdmin
          .from("archive_backfill_windows")
          .update({
            status: "done",
            rows_stored: n,
            error: null,
            completed_at: new Date().toISOString(),
          })
          .eq("id", next.id);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        const attempts = (next.attempts ?? 0) + 1;
        if (e instanceof ThrottledError) {
          // Not the window's fault: give the attempt back and retry it later.
          await supabaseAdmin
            .from("archive_backfill_windows")
            .update({ status: "pending", attempts: next.attempts ?? 0, error: message })
            .eq("id", next.id);
          throttled = true;
          await sleep(12_000);
          continue;
        }
        const failed = attempts >= MAX_ATTEMPTS;
        await supabaseAdmin
          .from("archive_backfill_windows")
          .update({ status: failed ? "failed" : "error", error: message })
          .eq("id", next.id);
        console.error("[archive-backfill]", next.window_key, message);
      }

    }
  } finally {
    await releaseLease();
  }

  const progress = await backfillProgress();

  // Circuit breaker: if everything keeps failing, park the job for the owner.
  if (progress.failed > 0 && progress.done === 0 && progress.failed >= 5) {
    await pauseJob("Repeated failures fetching the historical archive source.");
  }

  return { processed, stored, throttled, ...progress };
}
