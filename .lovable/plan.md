# The Progressor Podcast — weekly audio edition

A free weekly ~20-30 minute podcast, hosted by "The Progressor," written and voiced automatically each week from the week's top coverage.

## The host's personality

The Progressor is a single AI host with a fixed persona used in every script:

- **Identity**: Opens by naming itself and stating plainly that it is an AI editor — no coyness, no pretending otherwise. It has a beat (U.S. politics and policy), a memory of the week, and a point of view about what matters, not about who should win.
- **Register**: comic-anchor. Tongue-in-cheek and funny, in the John Oliver / Colbert lane — incredulity, deadpan asides, a well-placed sigh — while the underlying reporting stays straight. The joke is about the absurdity of a situation, never a smear of a person. Facts are delivered clean; the humor lives in the framing around them.
- **Craft rules baked into the writing prompt**: short sentences; contractions; one clear idea per paragraph; "here's what happened / here's why it matters / here's what to watch." A comic beat or aside roughly once per segment, not every line. Self-aware jokes about being an AI are allowed and encouraged early on. No lists read aloud like a list. No hedging stacks. Names sources out loud.
- **Guardrails**: humor never replaces the facts of a segment, no mockery of private individuals or identity, no advocacy language, no calls to action beyond "watch this," no speculation presented as reporting, corrections stated plainly when the week's coverage shifted.


### Episode structure

1. Cold open — the single biggest thing that happened, in about 45 seconds.
2. AI disclosure + host intro ("I'm The Progressor. I'm an AI editor…").
3. Sponsor read — the week's active sponsors, read in the host's own voice from the managed list.
4. Three to five segments on the week's top stories, each: what happened, why it matters, what to watch.
5. One short explainer detour on a term or mechanism that came up.
6. Close — what next week hinges on, contact/feedback, sign-off.

## Voice: hear both first

Before locking the pipeline in, I'll generate two ~60-second samples of the same cold open — one warm/conversational (Hayes-leaning), one calm/measured (Tur-leaning) — and put them on the podcast page for you to A/B. You pick one and I set it as the standing host voice.

## What gets built

**Page** — `/podcast`: show description, host bio explaining the AI disclosure, latest episode with an audio player (play/pause, scrub, speed), episode archive with dates, titles, summaries, and chapter/segment list. Free for everyone, no auth. Own SEO metadata plus `PodcastEpisode` structured data, and an RSS feed at `/podcast/rss.xml` so it can be submitted to Apple/Spotify later.

**Sponsors** — a managed `sponsors` table (name, copy the host reads, link, active window, sort order) that only you can edit, plus a small admin panel in your dashboard to add/edit/deactivate sponsors. Active sponsors are pulled into each week's script and shown on the episode page.

**Weekly pipeline** — a scheduled job that: pulls the week's published articles, has the AI editor write a full episode script under the persona above, splits it into narration chunks, generates audio, stitches the episode into one MP3, uploads it to storage, and saves the episode row with title, summary, chapters, script transcript, duration, and sponsor list. The transcript is published on the page too (good for SEO and accessibility).

**Manual controls** — a generate/regenerate button for you (admin-gated like the existing edition generator) so you can rerun a week if the output disappoints, and a draft state so an episode isn't public until you're happy with it if you'd rather review first.

## Technical notes

- New tables: `podcast_episodes` (slug, title, summary, script, chapters jsonb, audio_url, duration_seconds, week_start, published_at, status) and `sponsors`. Public read policies for published episodes and active sponsors; writes restricted to the admin role via existing role checks. Grants included in the migration.
- Script generation: `src/lib/generate-podcast.server.ts` using the Lovable AI Gateway with the persona system prompt; target ~3,800-4,500 words for 20-30 minutes.
- Audio: `openai/gpt-4o-mini-tts` with `response_format: "mp3"`, chunked at sentence boundaries (reusing the existing `chunkForNarration` helper), chunks concatenated and uploaded to a public `podcast` storage bucket via the admin client. Generation runs in the cron handler, not in a request the user waits on.
- Cron: new `/api/public/hooks/generate-podcast` route (same publishable-key auth as the weekly digest) scheduled Sundays via `pg_cron`, after the weekly digest.
- Newsletter: the weekly digest email gains a "This week's episode" block linking to the new episode.
- Cost note: a full 25-minute TTS episode is a meaningful per-week credit spend; the manual regenerate button will warn before rerunning.
