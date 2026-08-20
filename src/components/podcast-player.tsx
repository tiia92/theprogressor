import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

function fmt(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PodcastPlayer({ src, fallbackDuration }: { src: string; fallbackDuration?: number | null }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(fallbackDuration ?? 0);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    setPlaying(false);
    setTime(0);
  }, [src]);

  function toggle() {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  }

  function cycleRate() {
    const next = rate === 1 ? 1.25 : rate === 1.25 ? 1.5 : rate === 1.5 ? 2 : 1;
    setRate(next);
    if (ref.current) ref.current.playbackRate = next;
  }

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuration(d);
        }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onEnded={() => setPlaying(false)}
      />
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          aria-label={playing ? "Pause episode" : "Play episode"}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>

        <input
          type="range"
          min={0}
          max={duration || 0}
          step={1}
          value={Math.min(time, duration || 0)}
          onChange={(e) => {
            const v = Number(e.target.value);
            setTime(v);
            if (ref.current) ref.current.currentTime = v;
          }}
          aria-label="Seek"
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
        />

        <span className="shrink-0 font-mono text-xs text-muted-foreground">
          {fmt(time)} / {fmt(duration)}
        </span>

        <button
          onClick={cycleRate}
          className="shrink-0 rounded-md border border-border px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {rate}×
        </button>
      </div>
      <a
        href={src}
        download
        className="mt-3 inline-block font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
      >
        Download MP3
      </a>
    </div>
  );
}
