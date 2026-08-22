# Episode video: cover art + waveform MP4

Every podcast episode gets a matching MP4 — the show's cover art held full-frame with an audio waveform reacting along the bottom — so you can upload episodes straight to YouTube or post them as video anywhere.

## What the video looks like

- Full-frame podcast cover art (the Option A brand cover), 1920x1080, letterboxed on brand navy so the square art sits centered.
- A live waveform across the lower band, drawn in the ember accent color so it reads as part of the brand.
- Episode title in the corner, static, in the site's serif.
- Audio is the exact episode MP3, unaltered.

## One important constraint

The app's backend runs in an edge runtime that cannot render video — there is no ffmpeg there. So the weekly automation can't render the MP4 inside the cron job the way it generates the script and audio. The workable split:

- **Rendering** happens in the build sandbox with ffmpeg, driven by a repeatable script committed to the project (`scripts/render-episode-video.mjs`). It takes an episode slug, pulls the MP3 and cover, renders the MP4, and uploads it back to episode storage.
- **The app** stores and surfaces the result: a `video_path` column on episodes, a "Download video" link on the episode page, and the video in place of the plain player when one exists.

Practically that means each week you say "render the video for this week's episode" (or I do it as part of the weekly check) and it takes about a minute. If you'd rather it be fully hands-off later, the same script can move to an external scheduled runner — worth doing only once the weekly rhythm is settled.

## Scope of this build

1. **Backfill now** — render MP4s for the existing published episodes and store them.
2. **The script** — committed, takes `--slug`, idempotent, skips if a video already exists unless `--force`.
3. **Database** — add `video_path` to `podcast_episodes`.
4. **Serving** — a public route `/api/public/podcast-video/$slug.mp4` mirroring the existing audio route, so the file streams from storage with correct headers.
5. **Episode page** — when a video exists, show a "Download MP4" action next to the existing download and share buttons; the audio player stays the primary experience on the page.
6. **RSS** — leave the audio feed as-is; podcast apps expect the MP3 enclosure.

## Technical notes

- ffmpeg filter chain: `showwaves` (mode `cline`, ember `#d95f2b`) composited over the scaled cover on a navy canvas, `-c:v libx264 -tune stillimage -pix_fmt yuv420p -c:a copy`, framerate 15 to keep the file small for a ~28 minute episode (expect roughly 40-80 MB).
- The script reads the MP3 through the existing storage bucket with the admin client, writes to `/tmp`, and uploads `{slug}.mp4` to the same `podcast` bucket.
- Migration adds `video_path text` to `podcast_episodes`; existing grants and public-read policy already cover it.
