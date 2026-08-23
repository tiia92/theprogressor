import { createFileRoute, Link } from "@tanstack/react-router";

const DESCRIPTION =
  "Listen to sample intro theme music, mid-show transition stingers, and the outro bed for The Progressor Podcast — all synthesized in-house and royalty-free.";

export const Route = createFileRoute("/podcast/music")({
  component: MusicPage,
  head: () => ({
    meta: [
      { title: "Podcast Theme Music Samples — The Progressor" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Podcast Theme Music Samples" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://theprogressor.lovable.app/podcast/music" }],
  }),
});

interface Cue {
  file: string;
  name: string;
  role: string;
  note: string;
}

const CUES: Cue[] = [
  {
    file: "/audio/theme-intro.mp3",
    name: "Intro theme",
    role: "Cold open → host greeting",
    note: "14s. D minor, 100 BPM. Builds from a bare pulse to the full motif, then lands on a hit you can talk over.",
  },
  {
    file: "/audio/transition-a.mp3",
    name: "Transition A — neutral pivot",
    role: "Topic to topic",
    note: "3.4s. Same key as the theme, no emotional lean. The workhorse cue between segments.",
  },
  {
    file: "/audio/transition-b.mp3",
    name: "Transition B — lift",
    role: "Into lighter or hopeful material",
    note: "3.4s. Major chord, brighter top end. Use after a heavy segment.",
  },
  {
    file: "/audio/transition-c.mp3",
    name: "Transition C — heavier turn",
    role: "Into serious material",
    note: "3.4s. Minor, darker voicing. Signals a change in weight without being grim.",
  },
  {
    file: "/audio/theme-outro.mp3",
    name: "Outro bed",
    role: "Credits and sign-off",
    note: "8s. Slow chord walk resolving home. Long enough to run sponsor and credit reads underneath.",
  },
];

function MusicPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link to="/podcast" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to the podcast
      </Link>

      <h1 className="mt-6 text-4xl">Theme music samples</h1>
      <p className="mt-4 text-muted-foreground">
        Original cues synthesized for the show — no licensing, no attribution, no external service.
        These are the cues in use: the theme opens every episode, a stinger marks each new segment,
        and the outro bed runs under the sign-off.
      </p>

      <div className="mt-10 space-y-8">
        {CUES.map((cue) => (
          <section key={cue.file} className="border-t border-border pt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-2xl">{cue.name}</h2>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                {cue.role}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{cue.note}</p>
            <audio controls preload="none" src={cue.file} className="mt-4 w-full">
              Your browser does not support audio playback.
            </audio>
            <a
              href={cue.file}
              download
              className="mt-2 inline-block text-xs text-muted-foreground underline hover:text-foreground"
            >
              Download MP3
            </a>
          </section>
        ))}
      </div>
    </div>
  );
}
