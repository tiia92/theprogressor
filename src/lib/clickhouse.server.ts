// Server-only: ClickHouse analytics store, reached through the Lovable connector gateway.
// Postgres (Lovable Cloud) stays the system of record for articles and reports;
// ClickHouse holds one row per classified claim so we can query the
// fact/claim/analysis/rhetoric/unknown mix quickly over time.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/clickhouse";
export const CLAIMS_TABLE = "default.progressor_claims";

export interface ClaimRow {
  report_id: string;
  week_start: string;
  story_slug: string;
  story_title: string;
  claim_text: string;
  classification: string;
  corroborating_sources: number;
  disputed: number;
  topics: string[];
  outlets: string[];
}

function creds() {
  const lovableKey = process.env['LOVABLE_API_KEY'];
  const connectionKey = process.env['CLICKHOUSE_API_KEY'];
  if (!lovableKey || !connectionKey) return null;
  return { lovableKey, connectionKey };
}

export function clickhouseConfigured() {
  return creds() !== null;
}

async function run(query: string, body?: string) {
  const c = creds();
  if (!c) throw new Error("ClickHouse is not connected");
  const url = new URL(`${GATEWAY_URL}/`);
  url.searchParams.set("query", query);
  const resp = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.lovableKey}`,
      "X-Connection-Api-Key": c.connectionKey,
      "Content-Type": "text/plain",
      "X-ClickHouse-Setting-max_execution_time": "60",
    },
    body: body ?? "",
  });
  const text = await resp.text();
  if (!resp.ok) {
    console.error(`[clickhouse] ${resp.status}: ${text}`);
    throw new Error(`ClickHouse request failed [${resp.status}]: ${text}`);
  }
  return text;
}

export async function ensureClaimsTable() {
  await run(
    `CREATE TABLE IF NOT EXISTS ${CLAIMS_TABLE} (
      report_id String,
      week_start Date,
      story_slug String,
      story_title String,
      claim_text String,
      classification LowCardinality(String),
      corroborating_sources UInt8,
      disputed UInt8,
      topics Array(String),
      outlets Array(String),
      created_at DateTime DEFAULT now()
    ) ENGINE = MergeTree ORDER BY (week_start, story_slug, classification)`,
  );
}

/** Replays a report's claims into ClickHouse. Never throws — analytics is best-effort. */
export async function recordClaims(rows: ClaimRow[]): Promise<{ inserted: number; error?: string }> {
  if (!rows.length) return { inserted: 0 };
  if (!clickhouseConfigured()) return { inserted: 0, error: "ClickHouse not connected" };
  try {
    await ensureClaimsTable();
    await run(
      `ALTER TABLE ${CLAIMS_TABLE} DELETE WHERE report_id = '${rows[0]!.report_id.replace(/'/g, "")}'`,
    );
    const payload = rows.map((r) => JSON.stringify(r)).join("\n");
    await run(`INSERT INTO ${CLAIMS_TABLE} FORMAT JSONEachRow`, payload);
    return { inserted: rows.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[clickhouse] recordClaims failed", message);
    return { inserted: 0, error: message };
  }
}

export interface ClassificationCount {
  classification: string;
  claims: number;
}

/** Claim mix for a week (or overall when weekStart is omitted). */
export async function claimMix(weekStart?: string): Promise<ClassificationCount[]> {
  if (!clickhouseConfigured()) return [];
  try {
    const where = weekStart ? `WHERE week_start = '${weekStart.slice(0, 10)}'` : "";
    const text = await run(
      `SELECT classification, count() AS claims FROM ${CLAIMS_TABLE} ${where} GROUP BY classification ORDER BY claims DESC FORMAT JSON`,
    );
    const parsed = JSON.parse(text) as { data?: { classification: string; claims: string | number }[] };
    return (parsed.data ?? []).map((r) => ({
      classification: r.classification,
      claims: Number(r.claims),
    }));
  } catch (err) {
    console.error("[clickhouse] claimMix failed", err);
    return [];
  }
}
