import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { ArticleCard } from "@/components/article-card";
import { findTopic, TOPICS } from "@/lib/content-types";
import { listArticlesByTopic } from "@/lib/articles.functions";

const topicQuery = (topic: string) =>
  queryOptions({
    queryKey: ["topic-articles", topic],
    queryFn: () => listArticlesByTopic({ data: { topic, limit: 60 } }),
  });

export const Route = createFileRoute("/topic/$topic")({
  loader: async ({ params, context }) => {
    const topic = findTopic(params.topic);
    if (!topic) throw notFound();
    await context.queryClient.ensureQueryData(topicQuery(params.topic));
    return { topic };
  },
  head: ({ loaderData }) => {
    const t = loaderData?.topic;
    const title = t ? `${t.label} — The Progressor` : "Topic — The Progressor";
    const desc = t?.description ?? "Browse The Progressor's coverage of this topic — AI-generated news, analysis, and explainers on progressive politics.";
    const url = t ? `https://theprogressor.lovable.app/topic/${t.slug}` : "https://theprogressor.lovable.app/topics";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: title,
            description: desc,
            url,
            isPartOf: {
              "@type": "WebSite",
              name: "The Progressor",
              url: "https://theprogressor.lovable.app",
            },
          }),
        },
      ],
    };
  },
  component: TopicPage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <p className="text-sm text-muted-foreground">Couldn't load this topic.</p>
      <p className="mt-1 font-mono text-xs text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">404</p>
      <h1 className="mt-2 font-heading text-3xl text-foreground">Topic not found</h1>
      <Link to="/topics" className="mt-4 inline-block text-sm text-primary underline">
        See all topics
      </Link>
    </div>
  ),
});

function TopicPage() {
  const { topic } = Route.useParams();
  const t = findTopic(topic)!;
  const { data: articles } = useSuspenseQuery(topicQuery(topic));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-baseline gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Topic</p>
        <Link to="/topics" className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
          All topics →
        </Link>
      </div>
      <h1 className="mt-2 font-heading text-4xl text-foreground md:text-5xl">{t.label}</h1>
      <p className="mt-3 max-w-2xl text-base text-muted-foreground">{t.description}</p>

      {articles.length === 0 ? (
        <div className="mt-10 rounded-md border border-dashed border-border bg-muted/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing published under <span className="text-foreground">{t.label}</span> yet.
          </p>
          <Link to="/topics" className="mt-3 inline-block text-sm text-primary underline">
            Browse other topics
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((a: (typeof articles)[number]) => (
            <ArticleCard key={a.id} article={a} headingLevel="h2" />
          ))}
        </div>
      )}

      <div className="mt-14 border-t border-border pt-6">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Also explore</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {TOPICS.filter((x) => x.slug !== t.slug)
            .slice(0, 12)
            .map((x) => (
              <Link
                key={x.slug}
                to="/topic/$topic"
                params={{ topic: x.slug }}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                {x.label}
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}
