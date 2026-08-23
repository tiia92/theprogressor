import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PodcastPlayer } from "@/components/podcast-player";
import { PODCAST_COVER_ABSOLUTE, PODCAST_COVER_ALT, PODCAST_COVER_URL } from "@/lib/podcast-cover";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { triggerPodcastGeneration } from "@/lib/podcast.functions";

const ADMIN_EMAIL = "discussabilityonline@gmail.com";

const DESCRIPTION =
  "A free weekly 20-30 minute podcast: The Progressor, an AI host, walks through the week in U.S. politics and policy — straight reporting, dry humor, and what to watch next.";

export const Route = createFileRoute("/podcast/")({
  component: PodcastPage,
  head: () => ({
    meta: [
      { title: "The Progressor Podcast — the week in politics" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "The Progressor Podcast" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:image", content: PODCAST_COVER_ABSOLUTE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: PODCAST_COVER_ABSOLUTE },
    ],
    links: [
      { rel: "canonical", href: "https://theprogressor.lovable.app/podcast" },
      {
        rel: "alternate",
        type: "application/rss+xml",
        title: "The Progressor Podcast",
        href: "https://theprogressor.lovable.app/podcast/rss.xml",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "PodcastSeries",
          name: "The Progressor Podcast",
          description: DESCRIPTION,
          url: "https://theprogressor.lovable.app/podcast",
          webFeed: "https://theprogressor.lovable.app/podcast/rss.xml",
        }),
      },
    ],
  }),
});

export interface EpisodeRow {
  slug: string;
  title: string;
  summary: string;
  audio_path: string | null;
  duration_seconds: number | null;
  week_start: string;
  published_at: string | null;
  chapters: unknown;
}

export function audioUrl(slug: string) {
  return `/api/public/podcast-audio/${slug}`;
}

export function formatWeek(week: string) {
  return new Date(`${week}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function PodcastPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const generate = useServerFn(triggerPodcastGeneration);

  const episodes = useQuery({
    queryKey: ["podcast-episodes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("podcast_episodes")
        .select("slug, title, summary, audio_path, duration_seconds, week_start, published_at, chapters")
        .eq("status", "published")
        .order("week_start", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return (data ?? []) as EpisodeRow[];
    },
  });

  const gen = useMutation({
    mutationFn: async () => {
      const res = await generate({ data: {} });
      if (res && "error" in res && res.error) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      toast.success("Episode published");
      void qc.invalidateQueries({ queryKey: ["podcast-episodes"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Generation failed"),
  });

  const list = episodes.data ?? [];
  const latest = list[0];
  const archive = list.slice(1);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Listen</p>
      <h1 className="mt-2 font-heading text-4xl text-foreground md:text-5xl">
        The Progressor Podcast
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">{DESCRIPTION}</p>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <a
          href="/podcast/rss.xml"
          className="font-mono text-xs uppercase tracking-[0.14em] text-primary hover:underline"
        >
          RSS feed
        </a>
        <Link
          to="/podcast/music"
          className="font-mono text-xs uppercase tracking-[0.14em] text-primary hover:underline"
        >
          Theme music samples
        </Link>

        {user?.email === ADMIN_EMAIL && (
          <button
            onClick={() => {
              if (confirm("Generating a full episode costs real AI credits. Continue?")) gen.mutate();
            }}
            disabled={gen.isPending}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
          >
            {gen.isPending ? "Recording this week's episode…" : "Generate this week's episode"}
          </button>
        )}
      </div>

      <section className="mt-10 rounded-md border border-border bg-muted/20 p-5">
        <h2 className="font-heading text-2xl text-foreground">About your host</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The Progressor is an AI editor, and says so out loud in every episode. The reporting is
          straight — the same coverage you read on the site — and the humor lives in the framing
          around it, never in a smear of a person. Each episode walks through the week's biggest
          stories: what happened, why it matters, and what to watch.
        </p>
      </section>

      {episodes.isLoading ? (
        <p className="mt-10 text-sm text-muted-foreground">Loading episodes…</p>
      ) : !latest ? (
        <div className="mt-10 rounded-md border border-dashed border-border bg-muted/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            The first episode drops soon. New episodes publish every Sunday.
          </p>
        </div>
      ) : (
        <>
          <section className="mt-10">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Latest episode · week of {formatWeek(latest.week_start)}
            </p>
            <h2 className="mt-2 font-heading text-3xl text-foreground">
              <Link to="/podcast/$slug" params={{ slug: latest.slug }} className="hover:text-primary">
                {latest.title}
              </Link>
            </h2>
            <p className="mt-2 text-muted-foreground">{latest.summary}</p>
            <img
              src={PODCAST_COVER_URL}
              alt={PODCAST_COVER_ALT}
              loading="lazy"
              className="mt-4 w-full rounded-md border border-border object-cover"
            />
            <div className="mt-4">
              <PodcastPlayer
                src={audioUrl(latest.slug)}
                fallbackDuration={latest.duration_seconds}
              />
            </div>
            <Link
              to="/podcast/$slug"
              params={{ slug: latest.slug }}
              className="mt-3 inline-block text-sm text-primary hover:underline"
            >
              Chapters and full transcript →
            </Link>
          </section>

          {archive.length > 0 && (
            <section className="mt-12">
              <h2 className="font-heading text-2xl text-foreground">Archive</h2>
              <ul className="mt-4 divide-y divide-border border-t border-border">
                {archive.map((e) => (
                  <li key={e.slug} className="py-4">
                    <Link
                      to="/podcast/$slug"
                      params={{ slug: e.slug }}
                      className="font-heading text-xl text-foreground hover:text-primary"
                    >
                      {e.title}
                    </Link>
                    <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      Week of {formatWeek(e.week_start)}
                      {e.duration_seconds
                        ? ` · ${Math.round(e.duration_seconds / 60)} min`
                        : ""}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{e.summary}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
