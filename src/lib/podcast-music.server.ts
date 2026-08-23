// Server-only: the show's original music cues, stored alongside episode audio.
// All cues are 24 kHz mono 128 kbps MP3 so they concatenate cleanly with TTS audio.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "podcast";

export type CueName =
  | "theme-intro"
  | "transition-a"
  | "transition-b"
  | "transition-c"
  | "theme-outro";

const cache = new Map<CueName, Uint8Array>();

export async function loadCue(name: CueName): Promise<Uint8Array | null> {
  const cached = cache.get(name);
  if (cached) return cached;
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(`music/${name}.mp3`);
  if (error || !data) {
    console.error(`[podcast] music cue ${name} unavailable`, error?.message);
    return null;
  }
  const bytes = new Uint8Array(await data.arrayBuffer());
  cache.set(name, bytes);
  return bytes;
}

/** Which stinger plays going *into* a section, given its position in the run. */
export function transitionFor(kind: string, segmentIndex: number): CueName | null {
  switch (kind) {
    case "cold_open":
    case "intro":
    case "sponsors":
      return null;
    case "explainer":
      return "transition-b";
    case "close":
      return "transition-c";
    default:
      return segmentIndex % 2 === 0 ? "transition-a" : "transition-c";
  }
}

export function concatAudio(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** Approximate seconds of music added to an episode, for duration estimates. */
export const CUE_SECONDS: Record<CueName, number> = {
  "theme-intro": 14,
  "transition-a": 3.4,
  "transition-b": 3.4,
  "transition-c": 3.4,
  "theme-outro": 8,
};
