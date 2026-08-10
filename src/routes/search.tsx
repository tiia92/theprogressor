import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useState } from "react";
import { searchArticles } from "@/lib/articles.functions";
import { ArticleCard } from "@/components/article-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({ q: z.string().catch("").default("") });

const resultsQuery = (q: string) =>
  queryOptions({
    queryKey: ["search", q],
    queryFn: () => searchArticles({ data: { q, limit: 30 } }),
  });

export const Route = createFileRoute("/search")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(resultsQuery(deps.q)),
  component: SearchPage,
  head: ({ loaderData }) => {
    void loaderData;
    return {
      meta: [
        { title: "Search The Progressor — briefs, analysis, explainers" },
        {
          name: "description",
          content:
            "Search every The Progressor article: daily briefs, analysis, explainers, and opinion columns on U.S. politics.",
        },
        { property: "og:title", content: "Search The Progressor" },
        {
          property: "og:description",
          content: "Full-text search across every The Progressor article.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">
      Search failed: {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">No results.</div>
  ),
});

function SearchPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const [term, setTerm] = useState(q);
  const { data: results } = useSuspenseQuery(resultsQuery(q));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Search</p>
      <h1 className="mt-2 font-serif text-4xl font-bold text-foreground">Find a story</h1>

      <form
        className="mt-6 flex max-w-xl gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ to: "/search", search: { q: term.trim() } });
        }}
      >
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search headlines, deks, and full text…"
          aria-label="Search articles"
        />
        <Button type="submit">Search</Button>
      </form>

      {q.trim().length >= 2 && (
        <p className="mt-6 text-sm text-muted-foreground">
          {results.length} result{results.length === 1 ? "" : "s"} for “{q}”
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {results.map((a) => (
          <ArticleCard key={a.id} article={a} />
        ))}
      </div>
    </div>
  );
}
