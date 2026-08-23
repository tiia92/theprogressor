#!/usr/bin/env node
/**
 * Render a podcast episode as an MP4: the show cover art held full-frame on a
 * navy canvas with an ember waveform reacting along the bottom.
 *
 * Runs in the build sandbox (needs ffmpeg) — the app's edge runtime cannot
 * render video. Uploads {slug}.mp4 to the `podcast` bucket and records
 * video_path on the episode row.
 *
 *   node scripts/render-episode-video.mjs --slug week-of-2026-08-10 [--force]
 *   node scripts/render-episode-video.mjs --all [--force]
 */
import { createClient } from "@supabase/supabase-js";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const BUCKET = "podcast";
const NAVY = "0x0b2b5f";
const EMBER = "#f4703a";
const W = 1920;
const H = 1080;
const FPS = 12;
const COVER_URL = "https://theprogressor.lovable.app" +
  JSON.parse(await readFile(new URL("../src/assets/podcast-cover.png.asset.json", import.meta.url), "utf8")).url;

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function renderOne(episode, workdir, force) {
  const { slug } = episode;
  if (episode.video_path && !force) {
    console.log(`[skip] ${slug} already has a video`);
    return;
  }
  if (!episode.audio_path) {
    console.log(`[skip] ${slug} has no audio`);
    return;
  }

  console.log(`[render] ${slug}`);
  const audioFile = path.join(workdir, `${slug}.mp3`);
  const coverFile = path.join(workdir, "cover.png");
  const outFile = path.join(workdir, `${slug}.mp4`);

  const { data: audio, error: dlError } = await supabase.storage.from(BUCKET).download(episode.audio_path);
  if (dlError) throw new Error(`download failed: ${dlError.message}`);
  await writeFile(audioFile, Buffer.from(await audio.arrayBuffer()));

  const coverRes = await fetch(COVER_URL);
  if (!coverRes.ok) throw new Error(`cover fetch failed: ${coverRes.status}`);
  await writeFile(coverFile, Buffer.from(await coverRes.arrayBuffer()));

  // Cover scaled to fit above a waveform band, centered on navy, with the
  // episode title set quietly along the bottom for video platforms.
  const coverH = H - 200;
  const label = (episode.title ?? "")
    .replace(/[\\:']/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .slice(0, 90);
  const filter = [
    `color=c=${NAVY}:s=${W}x${H}:r=${FPS}[bg]`,
    `[1:v]scale=-1:${coverH}[cover]`,
    `[bg][cover]overlay=(W-w)/2:20:shortest=0[base]`,
    `[0:a]volume=8,showwaves=s=${W}x150:mode=cline:rate=${FPS}:scale=sqrt:draw=full:colors=${EMBER},format=rgba,colorkey=0x000000:0.01:0[wave]`,
    `[base][wave]overlay=0:${H - 165}:shortest=1[withwave]`,
    `[withwave]drawtext=font=serif:text='${label}':fontcolor=0xffffff@0.75:fontsize=30:x=(w-text_w)/2:y=${H - 45},format=yuv420p[v]`,
  ].join(";");

  await run(
    "ffmpeg",
    [
      "-y",
      "-i", audioFile,
      "-loop", "1", "-i", coverFile,
      "-filter_complex", filter,
      "-map", "[v]", "-map", "0:a",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "32", "-r", String(FPS),
      "-c:a", "copy",
      "-movflags", "+faststart",
      outFile,
    ],
    { maxBuffer: 1024 * 1024 * 32 },
  );

  const bytes = await readFile(outFile);
  const size = (await stat(outFile)).size;
  const videoPath = `${slug}.mp4`;
  const { error: upError } = await supabase.storage
    .from(BUCKET)
    .upload(videoPath, bytes, { contentType: "video/mp4", upsert: true });
  if (upError) throw new Error(`upload failed: ${upError.message}`);

  const { error: saveError } = await supabase
    .from("podcast_episodes")
    .update({ video_path: videoPath })
    .eq("slug", slug);
  if (saveError) throw new Error(saveError.message);

  console.log(`[done] ${slug} → ${videoPath} (${(size / 1e6).toFixed(1)} MB)`);
}

const slug = value("slug");
let query = supabase.from("podcast_episodes").select("slug, title, audio_path, video_path").order("week_start", { ascending: false });
if (slug) query = query.eq("slug", slug);
else if (!flag("all")) throw new Error("Pass --slug <slug> or --all");

const { data: episodes, error } = await query;
if (error) throw new Error(error.message);
if (!episodes?.length) throw new Error("No episodes found");

const workdir = await mkdtemp(path.join(tmpdir(), "episode-video-"));
for (const episode of episodes) {
  await renderOne(episode, workdir, flag("force"));
}
