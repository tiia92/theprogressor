import { createFileRoute, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listArticles } from "@/lib/articles.functions";
import { ArticleCard } from "@/components/article-card";
import { KIND_DESCRIPTION, KIND_LABEL } from "@/lib/content-types";

const VALID = ["news", "analysis", "explainer", "opinion"] as const;
type Kind = (typeof VALID)[number];

function kindQuery(kind: Kind) {
  return queryOptions({
    queryKey: ["articles", "kind", kind],
    queryFn: () => listArticles({ data: { kind, limit: 60 } }),
  });
}

export const Route = createFileRoute("/kind/$kind")({
  parseParams: ({ kind }) => {
    if (!VALID.includes(kind as Kind)) throw notFound();
    return { kind: kind as Kind };
  },
  loader: ({ context, params }) => context.queryClient.ensureQueryData(kindQuery(params.kind)),
  component: KindPage,
  head: ({ params }) => {
    const label = params?.kind ? KIND_LABEL[params.kind as Kind] : "Section";
    return {
      meta: [
        { title: `${label} — The Progressor` },
        { name: "description", content: KIND_DESCRIPTION[(params?.kind as Kind) ?? "news"] },
      ],
    };
  },
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-12 text-center text-muted-foreground">
      Couldn't load this section: {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-12 text-center text-muted-foreground">
      Section not found.
    </div>
  ),
});

function KindPage() {
  const { kind } = Route.useParams() as { kind: Kind };
  const { data } = useSuspenseQuery(kindQuery(kind));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 border-b border-border pb-4">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Section</p>
        <h1 className="mt-1 font-serif text-4xl font-bold text-foreground">
          {KIND_LABEL[kind]}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{KIND_DESCRIPTION[kind]}</p>
      </div>

      {data.length === 0 ? (
        <p className="text-muted-foreground">Nothing in this section yet.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((a) => (
            <ArticleCard key={a.id} article={a} noImage />
          ))}
        </div>
      )}
    </div>
  );
}
