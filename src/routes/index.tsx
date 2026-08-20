import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getHomepage } from "@/lib/articles.functions";
import { ArticleCard } from "@/components/article-card";
import { GenerateEditionButton } from "@/components/generate-edition-button";

const homepageQuery = queryOptions({
  queryKey: ["homepage"],
  queryFn: () => getHomepage(),
});

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatTodayUTC() {
  const d = new Date();
  return `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(homepageQuery),
  component: Home,
  head: () => ({
    meta: [
      { title: "Today's Progressive Briefing — The Progressor" },
      {
        name: "description",
        content:
          "Today's progressive briefing: what happened, why it matters, and what to watch next — written daily by an AI editor.",
      },
      {
        property: "og:title",
        content: "Today's Progressive Briefing — The Progressor",
      },
      {
        property: "og:description",
        content:
          "A daily brief, morning headlines, and deep-dive explainers on U.S. politics from an AI editor with a progressive lens.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://theprogressor.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://theprogressor.lovable.app/" }],
  }),
});

function Home() {
  const { data } = useSuspenseQuery(homepageQuery);

  if (data.totalCount === 0) {
    return <EmptyState />;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      <div className="mb-8 flex items-end justify-between border-b border-border pb-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            Today's edition
          </p>
          <h1 className="mt-1 font-heading text-3xl font-bold leading-tight text-foreground md:text-4xl">
            Today's Progressive Briefing — {formatTodayUTC()}
          </h1>
        </div>
        <GenerateEditionButton variant="compact" />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {data.brief ? (
            <ArticleCard article={data.brief} size="featured" withArt />
          ) : (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
              No daily brief yet today. Hit "Generate today's edition" to publish one.
            </div>
          )}

          {data.deepDives.length > 0 && (
            <section className="mt-10">
              <SectionHeading title="Deep Dives" href="/kind/explainer" />
              <div className="grid gap-6 sm:grid-cols-2">
                {data.deepDives.map((a) => (
                  <ArticleCard key={a.id} article={a} withArt />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="lg:col-span-1">
          {data.headlines && (
            <div className="rounded-lg border border-border bg-card p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                Morning Headlines
              </p>
              <Link
                to="/article/$slug"
                params={{ slug: data.headlines.slug }}
                className="mt-1 block font-heading text-xl font-semibold leading-tight text-foreground hover:text-primary"
              >
                {data.headlines.title}
              </Link>
              <p className="mt-2 text-sm text-muted-foreground">{data.headlines.dek}</p>
              <Link
                to="/article/$slug"
                params={{ slug: data.headlines.slug }}
                className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
              >
                Read the briefing →
              </Link>
            </div>
          )}

          {data.latest.length > 0 && (
            <div className="mt-8">
              <SectionHeading title="More coverage" href="/kind/news" />
              <div className="space-y-4">
                {data.latest.slice(0, 8).map((a) => (
                  <ArticleCard key={a.id} article={a} size="compact" />
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function SectionHeading({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between border-b border-border pb-2">
      <h2 className="font-heading text-xl font-semibold text-foreground">{title}</h2>
      <a href={href} className="text-xs font-medium uppercase tracking-wider text-primary hover:underline">
        View all
      </a>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">The Progressor</p>
      <h1 className="mt-3 font-heading text-4xl font-bold leading-tight text-foreground md:text-5xl">
        Progressive daily, explained by AI.
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
        Every article on this site is generated autonomously. The AI's mission
        doesn't change — become the best progressive daily explainer of U.S.
        politics.
      </p>
      <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground">
        Nothing has been published yet. Kick off the first edition to see what
        the editor cares about today.
      </p>
      <div className="mt-8">
        <GenerateEditionButton />
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Takes ~20–40 seconds.</p>
    </div>
  );
}
