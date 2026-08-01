import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArticleCard } from "@/components/article-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TOPICS } from "@/lib/content-types";
import {
  addKeyword,
  getFollowFeed,
  getReaderState,
  listSavedArticles,
  removeKeyword,
  toggleFollowTopic,
} from "@/lib/reader.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Your dashboard — NewSlop" },
      {
        name: "description",
        content:
          "Your followed topics and keywords, your saved stories, and the latest coverage matching them.",
      },
      { property: "og:title", content: "Your dashboard — NewSlop" },
      { property: "og:description", content: "Follows, keywords, and saved reading in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">
      Couldn't load your dashboard: {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">Nothing here yet.</div>
  ),
});

type Tab = "feed" | "follows" | "saved";

function Dashboard() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("feed");
  const [keyword, setKeyword] = useState("");

  const fetchState = useServerFn(getReaderState);
  const fetchFeed = useServerFn(getFollowFeed);
  const fetchSaved = useServerFn(listSavedArticles);
  const follow = useServerFn(toggleFollowTopic);
  const addKw = useServerFn(addKeyword);
  const rmKw = useServerFn(removeKeyword);

  const state = useQuery({ queryKey: ["reader-state"], queryFn: () => fetchState({}) });
  const feed = useQuery({ queryKey: ["follow-feed"], queryFn: () => fetchFeed({}) });
  const saved = useQuery({ queryKey: ["saved-articles"], queryFn: () => fetchSaved({}) });

  const followed = new Set(state.data?.topics ?? []);
  const keywords = state.data?.keywords ?? [];

  async function onToggleTopic(slug: string) {
    await follow({ data: { topic: slug, follow: !followed.has(slug) } });
    await qc.invalidateQueries({ queryKey: ["reader-state"] });
    await qc.invalidateQueries({ queryKey: ["follow-feed"] });
  }

  async function onAddKeyword(e: React.FormEvent) {
    e.preventDefault();
    const value = keyword.trim();
    if (value.length < 2) return;
    try {
      await addKw({ data: { keyword: value } });
      setKeyword("");
      await qc.invalidateQueries({ queryKey: ["reader-state"] });
      await qc.invalidateQueries({ queryKey: ["follow-feed"] });
    } catch {
      toast.error("Couldn't add that keyword.");
    }
  }

  async function onRemoveKeyword(word: string) {
    await rmKw({ data: { keyword: word } });
    await qc.invalidateQueries({ queryKey: ["reader-state"] });
    await qc.invalidateQueries({ queryKey: ["follow-feed"] });
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "feed", label: "Your feed" },
    { id: "follows", label: "Following" },
    { id: "saved", label: "Saved" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Dashboard</p>
      <h1 className="mt-2 font-serif text-4xl font-bold text-foreground md:text-5xl">
        Your reading
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        The homepage stays the full edition. This is your own cut of it: topics and keywords you
        follow, plus everything you've saved.
      </p>

      <div className="mt-8 flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 font-mono text-xs uppercase tracking-[0.14em] transition-colors ${
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "feed" && (
        <section className="mt-8">
          {feed.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading your feed…</p>
          ) : (feed.data ?? []).length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-muted/30 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nothing matched yet. Follow a few topics or add keywords.
              </p>
              <Button className="mt-4" variant="outline" onClick={() => setTab("follows")}>
                Pick topics
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {(feed.data ?? []).map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "follows" && (
        <section className="mt-8 space-y-10">
          <div>
            <h2 className="font-serif text-2xl font-semibold text-foreground">Topics</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tap to follow or unfollow. {followed.size} followed.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {TOPICS.map((t) => {
                const on = followed.has(t.slug);
                return (
                  <button
                    key={t.slug}
                    onClick={() => onToggleTopic(t.slug)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      on
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {on ? "✓ " : ""}
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="font-serif text-2xl font-semibold text-foreground">Keywords</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Precise terms — a bill name, a person, an agency. We match them across full article
              text.
            </p>
            <form onSubmit={onAddKeyword} className="mt-4 flex max-w-md gap-2">
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="e.g. filibuster"
                maxLength={60}
              />
              <Button type="submit">Add</Button>
            </form>
            <div className="mt-4 flex flex-wrap gap-2">
              {keywords.length === 0 && (
                <p className="text-sm text-muted-foreground">No keywords yet.</p>
              )}
              {keywords.map((w) => (
                <span
                  key={w}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground"
                >
                  {w}
                  <button
                    onClick={() => onRemoveKeyword(w)}
                    aria-label={`Remove ${w}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === "saved" && (
        <section className="mt-8">
          {saved.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (saved.data ?? []).length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-muted/30 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nothing saved yet. Use “Save for later” on any article.
              </p>
              <Link to="/" className="mt-3 inline-block text-sm text-primary underline">
                Browse today's edition
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {(saved.data ?? []).map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
