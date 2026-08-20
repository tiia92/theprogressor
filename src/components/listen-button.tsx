import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pause, Play, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { narrateArticleChunk } from "@/lib/narration.functions";

const btn =
  "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-50";

export function ListenButton({ slug }: { slug: string }) {
  const { user, loading } = useAuth();
  const { isPro, loading: subLoading } = useSubscription();
  const narrate = useServerFn(narrateArticleChunk);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Map<number, string>>(new Map());
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "playing" | "paused">("idle");

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  async function fetchChunk(i: number): Promise<string | null> {
    const cached = cacheRef.current.get(i);
    if (cached) return cached;
    const res = await narrate({ data: { slug, chunk: i } });
    if ("error" in res) {
      toast.error(res.error);
      return null;
    }
    setTotal(res.total);
    cacheRef.current.set(i, res.audio);
    return res.audio;
  }

  async function playFrom(i: number) {
    setState("loading");
    const audio = await fetchChunk(i);
    if (!audio) {
      setState("idle");
      return;
    }
    const el = audioRef.current ?? new Audio();
    audioRef.current = el;
    el.src = `data:audio/mpeg;base64,${audio}`;
    el.onended = () => {
      const next = i + 1;
      if (total !== null && next >= total) {
        setState("idle");
        setIndex(0);
        return;
      }
      setIndex(next);
      void playFrom(next);
    };
    try {
      await el.play();
      setIndex(i);
      setState("playing");
      void fetchChunk(i + 1).catch(() => {});
    } catch {
      setState("idle");
      toast.error("Couldn't start playback.");
    }
  }

  function onClick() {
    if (state === "playing") {
      audioRef.current?.pause();
      setState("paused");
      return;
    }
    if (state === "paused" && audioRef.current) {
      void audioRef.current.play();
      setState("playing");
      return;
    }
    void playFrom(index);
  }

  if (loading || subLoading) return null;

  if (!user || !isPro) {
    return (
      <Link to="/pricing" className={btn} title="Audio narration is a Pro feature">
        <Volume2 className="h-3.5 w-3.5" />
        Listen (Pro)
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={btn} disabled={state === "loading"}>
      {state === "loading" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : state === "playing" ? (
        <Pause className="h-3.5 w-3.5" />
      ) : (
        <Play className="h-3.5 w-3.5" />
      )}
      {state === "loading"
        ? "Generating audio…"
        : state === "playing"
          ? "Pause"
          : state === "paused"
            ? "Resume"
            : "Listen"}
    </button>
  );
}
