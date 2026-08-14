import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getArticleBySlug } from "@/lib/articles.functions";
import { ArticleBody } from "@/components/article-body";
import { ArticleActions } from "@/components/article-actions";
import { KindBadge, TypeLabel } from "@/components/article-card";
import { heroGradientClass, TYPE_TO_KIND, type ArticleType } from "@/lib/content-types";

function articleQuery(slug: string) {
  return queryOptions({
    queryKey: ["article", slug],
    queryFn: () => getArticleBySlug({ data: { slug } }),
  });
}

export const Route = createFileRoute("/article/$slug")({
  loader: async ({ context, params }) => {
    const row = await context.queryClient.ensureQueryData(articleQuery(params.slug));
    if (!row) throw notFound();
    return row;
  },
  component: ArticlePage,
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    return {
      meta: [
        { title: `${loaderData.title} — The Progressor` },
        { name: "description", content: loaderData.dek },
        { property: "og:title", content: loaderData.title },
        { property: "og:description", content: loaderData.dek },
        { property: "og:type", content: "article" },
        { property: "article:published_time", content: loaderData.published_at },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="font-serif text-3xl font-semibold text-foreground">Article not found</h1>
      <p className="mt-2 text-muted-foreground">This story may have been unpublished.</p>
      <Link to="/" className="mt-6 inline-block text-primary hover:underline">
        ← Back to today's edition
      </Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center text-muted-foreground">
      Couldn't load this article: {error.message}
    </div>
  ),
});

const MONTHS_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// Deterministic (UTC, fixed locale) so SSR and client markup match.
function fmtArticleDate(iso: string) {
  const d = new Date(iso);
  return `${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function ArticlePage() {
  const { data: article } = useSuspenseQuery(articleQuery(Route.useParams().slug));
  if (!article) return null;

  const kind = TYPE_TO_KIND[article.article_type as ArticleType] ?? "news";
  const sources = (article.sources as { title: string; url?: string }[] | null) ?? [];

  return (
    <article>
      {article.hero_image_url ? (
        <div className="relative">
          <img
            src={article.hero_image_url}
            alt=""
            width={1536}
            height={1024}
            loading="eager"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/40" />
          <div className="relative mx-auto max-w-3xl px-4 py-14 text-white md:py-20">
            <div className="mb-4 flex items-center gap-3">
              <KindBadge type={article.article_type} />
              <TypeLabel type={article.article_type} />
              <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-white/80">
                {fmtArticleDate(article.published_at)}
              </span>
            </div>

            <h1 className="font-serif text-3xl font-bold leading-tight text-white md:text-5xl">
              {article.title}
            </h1>
            <p className="mt-4 font-serif text-xl italic leading-snug text-white/90 md:text-2xl">
              {article.dek}
            </p>
          </div>
        </div>
      ) : (
        <div className={`h-56 w-full md:h-72 ${heroGradientClass(article.hero_gradient)}`} />
      )}
      <div className="mx-auto max-w-3xl px-4 py-10">
        {!article.hero_image_url && (
          <>
            <div className="mb-4 flex items-center gap-3">
              <KindBadge type={article.article_type} />
              <TypeLabel type={article.article_type} />
              <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {fmtArticleDate(article.published_at)}
              </span>
            </div>

            <h1 className="font-serif text-3xl font-bold leading-tight text-foreground md:text-5xl">
              {article.title}
            </h1>
            <p className="mt-4 font-serif text-xl italic leading-snug text-muted-foreground md:text-2xl">
              {article.dek}
            </p>
          </>
        )}
        <div className="my-6 flex items-center gap-3 border-y border-border py-3 text-xs text-muted-foreground">
          <span className="font-mono uppercase tracking-[0.14em]">By The Progressor AI Editor</span>
          <span>·</span>
          <span className="capitalize">{article.category.replace("_", " ")}</span>
        </div>

        {kind !== "news" && (
          <div className="mb-6 rounded-md border-l-4 border-primary bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
            <strong className="text-foreground">
              This is {kind === "opinion" ? "an opinion piece" : `an ${kind}`}.
            </strong>{" "}
            {kind === "opinion"
              ? "It reflects an editorial viewpoint, not factual reporting."
              : kind === "analysis"
                ? "It interprets recent events. Factual reporting is separated in the News section."
                : "This is evergreen background, kept up to date over time."}
          </div>
        )}

        <div className="mb-8">
          <ArticleActions
            articleId={article.id}
            slug={article.slug}
            title={article.title}
            upvotes={article.upvotes}
          />
        </div>

        <ArticleBody>{article.body}</ArticleBody>

        {sources.length > 0 && (
          <section className="mt-10 border-t border-border pt-6">
            <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Sources
            </h3>
            <ul className="mt-3 space-y-1 text-sm">
              {sources.map((s, i) => (
                <li key={i}>
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {s.title}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">{s.title}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-12 rounded-lg border border-border bg-muted/40 p-6 text-sm text-muted-foreground">
          <p className="font-serif text-base text-foreground">
            Every article on The Progressor is generated by an AI editor.
          </p>
          <p className="mt-2">
            Our mission stays consistent: the best progressive daily explainer
            of U.S. politics. The learning is in which stories deserve deeper
            attention, not in the editorial orientation.
          </p>
        </div>
      </div>
    </article>
  );
}
