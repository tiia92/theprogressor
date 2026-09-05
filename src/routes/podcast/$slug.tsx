import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PodcastComments } from "@/components/podcast-comments";
import { PodcastPlayer } from "@/components/podcast-player";
import { PODCAST_COVER_ABSOLUTE, PODCAST_COVER_ALT, PODCAST_COVER_URL } from "@/lib/podcast-cover";
import { PodcastShareActions } from "@/components/podcast-share-actions";
import { supabase } from "@/integrations/supabase/client";

interface Chapter {
  title: string;
  summary: string;
}

interface Episode {
  slug: string;
  title: string;
  summary: string;
  script: string;
  chapters: Chapter[] | null;
  duration_seconds: number | null;
  week_start: string;
  published_at: string | null;
  video_path: string | null;
}

function formatWeek(week: string) {
  return new Date(`${week}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const Route = createFileRoute("/podcast/$slug")({
  component: EpisodePage,
  head: ({ params }) => ({
    meta: [
      { title: `Episode ${params.slug} — The Progressor Podcast` },
      {
        name: "description",
        content:
          "A weekly 20-30 minute walk through the week in U.S. politics and policy, hosted by The Progressor.",
      },
      { property: "og:title", content: "The Progressor Podcast episode" },
      {
        property: "og:description",
        content: "The week in U.S. politics and policy, explained by The Progressor.",
      },
      { property: "og:type", content: "article" },
      { property: "og:image", content: PODCAST_COVER_ABSOLUTE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: PODCAST_COVER_ABSOLUTE },

    ],
    links: [
      {
        rel: "canonical",
        href: `https://theprogressor.lovable.app/podcast/${params.slug}`,
      },
    ],
  }),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">
      That episode doesn't exist.{" "}
      <Link to="/podcast" className="text-primary underline">
        Back to the podcast
      </Link>
    </div>
  ),
});

function EpisodePage() {
  const { slug } = Route.useParams();

  const episode = useQuery({
    queryKey: ["podcast-episode", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("podcast_episodes")
        .select("slug, title, summary, script, chapters, duration_seconds, week_start, published_at, video_path")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw notFound();
      return data as unknown as Episode;
    },
  });

  if (episode.isLoading) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-muted-foreground">Loading…</div>;
  }
  const e = episode.data;
  if (!e) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">
        That episode doesn't exist.{" "}
        <Link to="/podcast" className="text-primary underline">
          Back to the podcast
        </Link>
      </div>
    );
  }

  const chapters = Array.isArray(e.chapters) ? e.chapters : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        to="/podcast"
        className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
      >
        ← The Progressor Podcast
      </Link>
      <img
        src={PODCAST_COVER_URL}
        alt={PODCAST_COVER_ALT}
        loading="lazy"
        className="mt-4 w-full rounded-md border border-border object-cover"
      />
      <h1 className="mt-4 font-heading text-4xl text-foreground">{e.title}</h1>
      <p className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
        Week of {formatWeek(e.week_start)}
        {e.duration_seconds ? ` · ${Math.round(e.duration_seconds / 60)} min` : ""}
      </p>
      <p className="mt-3 text-muted-foreground">{e.summary}</p>

      <div className="mt-6">
        <PodcastPlayer
          src={`/api/public/podcast-audio/${e.slug}`}
          fallbackDuration={e.duration_seconds}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <PodcastShareActions slug={e.slug} title={e.title} />
        {e.video_path ? (
          <>
            <a
              href={`/api/public/podcast-video/${e.slug}.mp4`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
            >
              Download MP4
            </a>
            <a
              href={`/api/public/podcast-video/${e.slug}.mp4?inline`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
            >
              Watch video
            </a>
          </>
        ) : null}

        <a
          href="/podcast/rss.xml"
          className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
        >
          RSS feed
        </a>
      </div>

      {chapters.length > 0 && (
        <section className="mt-10">
          <h2 className="font-heading text-2xl text-foreground">In this episode</h2>
          <ol className="mt-4 space-y-3">
            {chapters.map((c, i) => (
              <li key={i} className="border-l-2 border-border pl-4">
                <p className="font-heading text-lg text-foreground">{c.title}</p>
                <p className="text-sm text-muted-foreground">{c.summary}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-heading text-2xl text-foreground">Transcript</h2>
        <div className="mt-4 space-y-4 text-[1.05rem] leading-relaxed text-foreground/90">
          {e.script
            .split(/\n{2,}/)
            .filter(Boolean)
            .map((p, i) => (
              <p key={i}>{p}</p>
            ))}
        </div>
      </section>

      <PodcastComments slug={e.slug} />
    </div>
  );
}
