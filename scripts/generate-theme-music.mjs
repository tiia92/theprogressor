// Generates royalty-free podcast theme music + transition stingers
// with pure DSP math (no external services), then encodes to MP3 via ffmpeg.
//
// Usage: node scripts/generate-theme-music.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SR = 44100;
const OUT_DIR = join(process.cwd(), "public", "audio");
mkdirSync(OUT_DIR, { recursive: true });

const clamp = (v) => Math.max(-1, Math.min(1, v));
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

function buffer(seconds) {
  return new Float32Array(Math.ceil(seconds * SR));
}

function add(buf, startSec, samples, gain = 1) {
  const off = Math.floor(startSec * SR);
  for (let i = 0; i < samples.length; i++) {
    const j = off + i;
    if (j >= 0 && j < buf.length) buf[j] += samples[i] * gain;
  }
}

function env(i, len, a, d, s, r) {
  const t = i / SR;
  const total = len / SR;
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
  if (t > total - r) return s * Math.max(0, (total - t) / r);
  return s;
}

// Warm plucked/marimba-ish tone (additive with slight detune)
function pluck(freq, dur, { gain = 0.5, bright = 1 } = {}) {
  const len = Math.floor(dur * SR);
  const out = new Float32Array(len);
  const partials = [
    [1, 1],
    [2, 0.35 * bright],
    [3, 0.18 * bright],
    [4.01, 0.08 * bright],
  ];
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    let v = 0;
    for (const [mult, amp] of partials) {
      v += Math.sin(2 * Math.PI * freq * mult * t) * amp * Math.exp(-t * (3 + mult * 1.4));
    }
    out[i] = clamp(v * gain * env(i, len, 0.004, 0.08, 0.55, 0.12));
  }
  return out;
}

// Sustained pad (saw stack, gently filtered by rolling average)
function pad(freq, dur, { gain = 0.22, voices = 3 } = {}) {
  const len = Math.floor(dur * SR);
  const raw = new Float32Array(len);
  for (let v = 0; v < voices; v++) {
    const det = 1 + (v - (voices - 1) / 2) * 0.004;
    let phase = Math.random();
    const inc = (freq * det) / SR;
    for (let i = 0; i < len; i++) {
      phase = (phase + inc) % 1;
      raw[i] += (2 * phase - 1) * 0.5; // saw
    }
  }
  // one-pole lowpass
  const out = new Float32Array(len);
  let y = 0;
  const a = 0.055;
  for (let i = 0; i < len; i++) {
    y += a * (raw[i] / voices - y);
    out[i] = clamp(y * gain * env(i, len, 0.35, 0.4, 0.85, 0.6));
  }
  return out;
}

// Sub bass with soft click
function bass(freq, dur, { gain = 0.5 } = {}) {
  const len = Math.floor(dur * SR);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const v =
      Math.sin(2 * Math.PI * freq * t) * 0.9 +
      Math.sin(2 * Math.PI * freq * 2 * t) * 0.12;
    out[i] = clamp(v * gain * env(i, len, 0.006, 0.12, 0.6, 0.15));
  }
  return out;
}

// Noise-based percussion
function perc(dur, { gain = 0.25, decay = 26, tone = 0 } = {}) {
  const len = Math.floor(dur * SR);
  const out = new Float32Array(len);
  let hp = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const n = Math.random() * 2 - 1;
    hp = 0.92 * (hp + n - (out[i - 1] ?? 0));
    const body = tone ? Math.sin(2 * Math.PI * tone * t) * 0.6 : 0;
    out[i] = clamp((hp * 0.8 + body) * gain * Math.exp(-t * decay));
  }
  return out;
}

function riser(dur, { gain = 0.2, from = 200, to = 1600 } = {}) {
  const len = Math.floor(dur * SR);
  const out = new Float32Array(len);
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const p = i / len;
    const f = from * Math.pow(to / from, p);
    phase += f / SR;
    const n = (Math.random() * 2 - 1) * 0.25 * p;
    out[i] = clamp((Math.sin(2 * Math.PI * phase) * 0.5 + n) * gain * p * p);
  }
  return out;
}

// Simple stereo-ish plate reverb (mono feedback delays), returns wet mix
function reverb(buf, { mix = 0.22 } = {}) {
  const delays = [0.0297, 0.0371, 0.0411, 0.0437].map((d) => Math.floor(d * SR));
  const fb = 0.72;
  const out = Float32Array.from(buf);
  for (const d of delays) {
    const line = new Float32Array(buf.length);
    for (let i = 0; i < buf.length; i++) {
      const prev = i - d >= 0 ? line[i - d] : 0;
      line[i] = buf[i] + prev * fb;
    }
    for (let i = 0; i < buf.length; i++) out[i] += line[i] * (mix / delays.length);
  }
  return out;
}

function normalize(buf, peak = 0.89) {
  let max = 0;
  for (const v of buf) max = Math.max(max, Math.abs(v));
  if (max === 0) return buf;
  const g = peak / max;
  for (let i = 0; i < buf.length; i++) buf[i] = clamp(buf[i] * g);
  // 20ms fades to avoid clicks
  const f = Math.floor(0.02 * SR);
  for (let i = 0; i < f; i++) {
    buf[i] *= i / f;
    buf[buf.length - 1 - i] *= i / f;
  }
  return buf;
}

function writeWav(path, buf) {
  const n = buf.length;
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) data.writeInt16LE(Math.round(clamp(buf[i]) * 32767), i * 2);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([header, data]));
}

function toMp3(wavPath, mp3Path) {
  execFileSync("ffmpeg", ["-y", "-i", wavPath, "-codec:a", "libmp3lame", "-b:a", "192k", mp3Path], {
    stdio: "ignore",
  });
}

// ---------------------------------------------------------------- compositions
// Key: D minor-ish, 100 BPM. Motif: D–A–F–C (hopeful, forward-leaning)
const BPM = 100;
const beat = 60 / BPM;

function buildIntro() {
  const dur = 14;
  const buf = buffer(dur);
  const D3 = midi(50), A3 = midi(57), F3 = midi(53), C3 = midi(48);
  const D4 = midi(62), F4 = midi(65), A4 = midi(69), C5 = midi(72), E5 = midi(76), G4 = midi(67);

  // Bar structure: 8 bars of 4 beats
  const chords = [
    [D3, [D4, F4, A4]],
    [A3, [midi(69), midi(72), midi(76)]],
    [F3, [F4, A4, C5]],
    [C3, [midi(60), midi(64), G4]],
  ];

  for (let bar = 0; bar < 8; bar++) {
    const t = bar * 4 * beat;
    const [root, tri] = chords[bar % 4];
    add(buf, t, bass(root / 2, 4 * beat, { gain: bar < 2 ? 0.28 : 0.5 }));
    for (const n of tri) add(buf, t, pad(n, 4 * beat, { gain: bar < 2 ? 0.1 : 0.18 }));

    // pulse
    if (bar >= 1) {
      for (let b = 0; b < 4; b++) {
        add(buf, t + b * beat, perc(0.12, { gain: b % 2 === 0 ? 0.22 : 0.12, decay: 40 }));
        if (b === 2) add(buf, t + b * beat, perc(0.2, { gain: 0.3, decay: 18, tone: 180 }));
      }
    }

    // melody motif from bar 2
    if (bar >= 2) {
      const mel = [
        [0, D4], [0.75, F4], [1.5, A4], [2.25, C5], [3, A4],
      ];
      const alt = [
        [0, A4], [0.5, G4], [1.25, F4], [2, D4], [3, F4],
      ];
      const line = bar % 2 === 0 ? mel : alt;
      for (const [off, f] of line) {
        add(buf, t + off * beat, pluck(f, 0.9, { gain: 0.42 }));
      }
    }
    // sparkle top on last two bars
    if (bar >= 6) add(buf, t, pluck(E5, 1.6, { gain: 0.18, bright: 1.4 }));
  }

  // riser into the final downbeat
  add(buf, 4 * 4 * beat - 1.6, riser(1.6, { gain: 0.16 }));
  // final hit
  const end = 8 * 4 * beat;
  add(buf, end - 0.02, bass(midi(38), 2.4, { gain: 0.6 }));
  add(buf, end - 0.02, pluck(D4, 2.4, { gain: 0.4 }));
  add(buf, end - 0.02, perc(0.5, { gain: 0.3, decay: 8, tone: 90 }));

  return normalize(reverb(buf, { mix: 0.24 }));
}

function buildTransition(variant) {
  const dur = 3.4;
  const buf = buffer(dur);
  const sets = {
    a: { root: midi(50), notes: [midi(62), midi(65), midi(69)] },   // Dm — neutral pivot
    b: { root: midi(53), notes: [midi(65), midi(69), midi(72)] },   // F — lift / good news
    c: { root: midi(48), notes: [midi(60), midi(63), midi(67)] },   // Cm — heavier turn
  };
  const { root, notes } = sets[variant];

  add(buf, 0.0, bass(root / 2, 2.6, { gain: 0.45 }));
  notes.forEach((n, i) => {
    add(buf, i * 0.11, pluck(n, 1.6, { gain: 0.4 - i * 0.05 }));
    add(buf, i * 0.11, pad(n, 2.4, { gain: 0.12 }));
  });
  add(buf, 0, perc(0.3, { gain: 0.26, decay: 14, tone: 140 }));
  add(buf, 0.9, perc(0.14, { gain: 0.14, decay: 40 }));
  add(buf, 1.2, pluck(notes[notes.length - 1] * 2, 1.2, { gain: 0.16, bright: 1.5 }));

  return normalize(reverb(buf, { mix: 0.3 }), 0.82);
}

function buildOutro() {
  const dur = 8;
  const buf = buffer(dur);
  const chords = [
    [midi(53), [midi(65), midi(69), midi(72)]],
    [midi(48), [midi(60), midi(64), midi(67)]],
    [midi(50), [midi(62), midi(65), midi(69)]],
    [midi(50), [midi(62), midi(69), midi(74)]],
  ];
  chords.forEach(([root, tri], i) => {
    const t = i * 1.8;
    add(buf, t, bass(root / 2, 2.2, { gain: 0.42 }));
    tri.forEach((n) => add(buf, t, pad(n, 2.4, { gain: 0.16 })));
    add(buf, t, pluck(tri[0], 1.4, { gain: 0.3 }));
    if (i === 3) add(buf, t, pluck(tri[2], 2.6, { gain: 0.22, bright: 1.3 }));
  });
  return normalize(reverb(buf, { mix: 0.3 }), 0.85);
}

const tracks = [
  ["theme-intro", buildIntro()],
  ["transition-a", buildTransition("a")],
  ["transition-b", buildTransition("b")],
  ["transition-c", buildTransition("c")],
  ["theme-outro", buildOutro()],
];

for (const [name, buf] of tracks) {
  const wav = join(OUT_DIR, `${name}.wav`);
  const mp3 = join(OUT_DIR, `${name}.mp3`);
  writeWav(wav, buf);
  toMp3(wav, mp3);
  console.log("wrote", mp3, (buf.length / SR).toFixed(2) + "s");
}
console.log("done");
