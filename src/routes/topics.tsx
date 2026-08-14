import { createFileRoute, Link } from "@tanstack/react-router";
import { TOPICS } from "@/lib/content-types";

export const Route = createFileRoute("/topics")({
  head: () => ({
    meta: [
      { title: "Topics — The Progressor" },
      { name: "description", content: "Browse The Progressor by topic — from immigration and courts to climate, tech, and pop culture." },
      { property: "og:title", content: "Topics — The Progressor" },
      { property: "og:description", content: "Browse every topic The Progressor covers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Topics — The Progressor",
          description: "Browse The Progressor by topic — from immigration and courts to climate, tech, and pop culture.",
          url: "https://theprogressor.lovable.app/topics",
          isPartOf: {
            "@type": "WebSite",
            name: "The Progressor",
            url: "https://theprogressor.lovable.app",
          },
        }),
      },
    ],
  }),
  component: TopicsIndex,
});

function TopicsIndex() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Explore</p>
      <h1 className="mt-2 font-serif text-4xl font-bold text-foreground md:text-5xl">Topics</h1>
      <p className="mt-3 max-w-2xl text-base text-muted-foreground">
        Every article is tagged with one or more of these topics. Pick one to
        see everything we've written about it.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOPICS.map((t) => (
          <Link
            key={t.slug}
            to="/topic/$topic"
            params={{ topic: t.slug }}
            className="group block rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/30"
          >
            <p className="font-serif text-lg font-semibold text-foreground group-hover:text-primary">
              {t.label}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
