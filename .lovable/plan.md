# Give the AI a memory of news back to 2023

Right now the AI can only see roughly the last month of news. I confirmed this directly: a request for March 2023 comes back with "your plan permits you to request articles as far back as 2026-08-03." So the current news feed can't reach 2023 at any price short of upgrading it.

The fix is to build The Progressor its own news archive: backfill 2023 through today from a free historical source, and keep saving every headline we pull from now on so the archive keeps growing on its own.

## What changes for readers

- New articles can reference what actually happened before — "this is the third shutdown fight since 2023," with real coverage behind it.
- Insights can track a claim or a story across months and years instead of one week at a time.

## How it works

**1. A news archive table**

A new `news_archive` table in the database holds one row per headline: title, summary, outlet, URL, publish date, topics, and a text-search index. Duplicate URLs are ignored so nothing is stored twice.

**2. Backfill 2023 to today (free source)**

GDELT's document API is free and covers this period. A backfill job walks month by month across a fixed list of U.S. politics/policy query terms (voting rights, labor, climate, healthcare, housing, immigration, civil rights, courts, elections, economy), storing what it finds.

The job follows the safe-background-job rules already used elsewhere here:
- a lease row so only one run works at a time
- a bounded slice of work per run (one month-and-topic window at a time, capped)
- progress recorded per window, so a re-run skips finished windows
- halts and reports instead of looping on repeated errors

It runs as a scheduled endpoint under `src/routes/api/public/hooks/`, triggered on a short cron until the backfill completes, plus an admin-only "Run archive backfill" button on the Insights page showing progress (windows done / total, rows stored).

**3. Keep the archive growing**

The existing daily wire fetches (edition, explainers, analysis, opinion, insights) each write what they pull into `news_archive` before generating. No extra API calls, no extra cost.

**4. Let the AI use it**

- **Article generation:** before writing, look up the archive for the closest prior coverage of the same topic and entities from the last 3 years and hand the AI a short "prior context" block of dated headlines with outlets and URLs. It cites those the same way it cites today's wire.
- **Insights:** the Detect/Compare step gets the same historical lookup, so "what happened previously that provides context" is answered from real archived coverage. Claims already mirrored to the analytics store get a `first_seen` date so a claim can be tracked over time.

Retrieval is date-ranged and capped (top ~15 items per story) so prompts stay small.

## Technical notes

- New files: `src/lib/news-archive.server.ts` (write/search/lookup), `src/lib/backfill-archive.server.ts` (bounded windowed backfill with lease + progress), `src/routes/api/public/hooks/backfill-archive.ts`.
- Migration: `news_archive` (unique on url, GIN index on a `tsvector` of title+summary, index on published_at) and `archive_backfill_progress` (window key, status, rows, timestamps) plus a lease row. Both are service-role only, with GRANTs written in the same migration; nothing public reads them directly.
- GDELT returns metadata only (title, outlet, URL, date) — no article body. That's enough for grounding and citation, and it keeps the AI honest about not asserting details it can't see.
- Shared wire-writing helper called from the five existing generators; their current behavior is otherwise unchanged.
- Rough archive size for 3 years across those topics: tens of thousands of rows — small for Postgres.

## Not included

- No upgrade to the paid news plan; if you later want full article text for the archive period, that's the only way and we can revisit.
