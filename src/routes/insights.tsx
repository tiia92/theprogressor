import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  getArchiveBackfillProgress,
  getClaimMix,
  getLatestInsightReport,
  listInsightReports,
  triggerArchiveBackfill,
  triggerInsightsGeneration,
} from "@/lib/insights.functions";

import { useAuth } from "@/hooks/use-auth";

const ADMIN_EMAIL = "discussabilityonline@gmail.com";

const latestQuery = queryOptions({
  queryKey: ["insight-report", "latest"],
  queryFn: () => getLatestInsightReport(),
});
const archiveQuery = queryOptions({
  queryKey: ["insight-report", "archive"],
  queryFn: () => listInsightReports(),
});
const mixQuery = queryOptions({
  queryKey: ["insight-claim-mix"],
  queryFn: () => getClaimMix({ data: {} }),
});

export const Route = createFileRoute("/insights")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(latestQuery);
    await context.queryClient.ensureQueryData(archiveQuery);
    await context.queryClient.ensureQueryData(mixQuery);
  },
  component: InsightsPage,
  head: () => ({
    meta: [
      { title: "Insights: What's Confirmed, Disputed, and Unknown" },
      {
        name: "description",
        content:
          "A weekly evidence audit of the news: which facts are independently corroborated, where accounts disagree, which claims are still allegations, and what remains unknown.",
      },
      { property: "og:title", content: "Insights: What's Confirmed, Disputed, and Unknown" },
      {
        property: "og:description",
        content:
          "The Progressor's weekly evidence audit — corroborated facts, conflicting accounts, open allegations, and unanswered questions.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://theprogressor.lovable.app/insights" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://theprogressor.lovable.app/insights" }],
  }),
});

const LABELS: Record<string, { label: string; className: string }> = {
  confirmed_fact: { label: "Confirmed fact", className: "bg-primary/15 text-primary border-primary/30" },
  reported_claim: {
    label: "Reported claim",
    className: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400",
  },
  analysis: { label: "Analysis", className: "bg-sky-500/15 text-sky-700 border-sky-500/30 dark:text-sky-400" },
  political_rhetoric: {
    label: "Political rhetoric",
    className: "bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-400",
  },
  unknown: { label: "Unknown", className: "bg-muted text-muted-foreground border-border" },
};

interface Claim {
  text: string;
  classification: string;
  corroborating_sources?: number;
  disputed?: boolean;
  attribution?: string;
  note?: string;
}
interface Story {
  slug: string;
  title: string;
  status?: string;
  summary?: string;
  topics?: string[];
  outlets?: string[];
  claims?: Claim[];
  disagreements?: string[];
  unknowns?: string[];
  prior_context?: string[];
  article_slugs?: string[];
}

function formatDate(d: string) {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function asList(v: unknown): string[] {
  return Array.isArray(v) ? (v as string[]).filter((x) => typeof x === "string") : [];
}

function InsightsPage() {
  const { data: report } = useSuspenseQuery(latestQuery);
  const { data: archive } = useSuspenseQuery(archiveQuery);
  const { data: mix } = useSuspenseQuery(mixQuery);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Insights</p>
          <h1 className="mt-1 font-heading text-3xl leading-tight text-foreground md:text-4xl">
            What's confirmed, what's disputed, what's unknown
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Each week the desk detects developing stories, aggregates reporting across outlets,
            compares the accounts, and classifies every claim as confirmed fact, reported claim,
            analysis, political rhetoric, or unknown.
          </p>
        </div>
        <GenerateInsightsButton />
      </div>

      <ArchiveBackfillPanel />


      {!report ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          No insights report published yet. The desk publishes one every week.
        </div>
      ) : (
        <>
          <section className="rounded-lg border border-border bg-card p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
              Week of {formatDate(report.week_start)} – {formatDate(report.week_end)} ·{" "}
              {report.article_count} articles reviewed
            </p>
            <h2 className="mt-2 font-heading text-2xl leading-tight text-foreground">{report.title}</h2>
            <p className="mt-2 text-muted-foreground">{report.summary}</p>
            <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-foreground">
              {report.synthesis
                .split(/\n{2,}/)
                .filter(Boolean)
                .map((p, i) => (
                  <p key={i}>{p.replace(/^#+\s*/, "")}</p>
                ))}
            </div>
          </section>

          {mix.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 font-heading text-xl text-foreground">Claim mix, all weeks</h2>
              <div className="flex flex-wrap gap-2">
                {mix.map((m) => {
                  const meta = LABELS[m.classification] ?? LABELS['unknown']!;
                  return (
                    <span
                      key={m.classification}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${meta.className}`}
                    >
                      {meta.label}: {m.claims}
                    </span>
                  );
                })}
              </div>
            </section>
          )}

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <EvidenceList title="Independently corroborated" items={asList(report.confirmed)} tone="primary" />
            <EvidenceList title="Where accounts disagree" items={asList(report.disputed)} tone="amber" />
            <EvidenceList title="Still allegations" items={asList(report.allegations)} tone="rose" />
            <EvidenceList title="What remains unknown" items={asList(report.unknowns)} tone="muted" />
          </div>

          {asList(report.prior_context).length > 0 && (
            <section className="mt-8 rounded-lg border border-border bg-muted/40 p-6">
              <h2 className="font-heading text-xl text-foreground">What came before</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {asList(report.prior_context).map((c, i) => (
                  <li key={i} className="border-l-2 border-border pl-3">
                    {c}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-10">
            <h2 className="mb-4 border-b border-border pb-2 font-heading text-2xl text-foreground">
              Developing stories
            </h2>
            <div className="space-y-4">
              {((report.stories ?? []) as unknown as Story[]).map((s) => (
                <StoryCard key={s.slug} story={s} />
              ))}
            </div>
          </section>

          {archive.length > 1 && (
            <section className="mt-10">
              <h2 className="mb-3 font-heading text-xl text-foreground">Earlier weeks</h2>
              <ul className="space-y-2 text-sm">
                {archive.slice(1).map((r) => (
                  <li key={r.slug} className="text-muted-foreground">
                    <span className="font-mono text-xs text-primary">{formatDate(r.week_start)}</span> —{" "}
                    {r.title}
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

function EvidenceList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "primary" | "amber" | "rose" | "muted";
}) {
  const accent = {
    primary: "border-l-primary",
    amber: "border-l-amber-500",
    rose: "border-l-rose-500",
    muted: "border-l-border",
  }[tone];
  return (
    <div className={`rounded-lg border border-border border-l-4 ${accent} bg-card p-5`}>
      <h3 className="font-heading text-lg text-foreground">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nothing recorded this week.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm text-foreground">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-muted-foreground">·</span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StoryCard({ story }: { story: Story }) {
  const [open, setOpen] = useState(false);
  const claims = story.claims ?? [];
  const counts = claims.reduce<Record<string, number>>((acc, c) => {
    acc[c.classification] = (acc[c.classification] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <article className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-4 p-5 text-left"
        aria-expanded={open}
      >
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
            {story.status ?? "Developing"}
            {story.outlets?.length ? ` · ${story.outlets.length} outlets` : ""}
          </p>
          <h3 className="mt-1 font-heading text-xl leading-tight text-foreground">{story.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{story.summary}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(counts).map(([k, n]) => {
              const meta = LABELS[k] ?? LABELS['unknown']!;
              return (
                <span key={k} className={`rounded-full border px-2 py-0.5 text-[11px] ${meta.className}`}>
                  {meta.label} {n}
                </span>
              );
            })}
          </div>
        </div>
        <span className="shrink-0 pt-1 text-sm text-muted-foreground">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="border-t border-border p-5 pt-4">
          <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Claim by claim
          </h4>
          <ul className="mt-3 space-y-3">
            {claims.map((c, i) => {
              const meta = LABELS[c.classification] ?? LABELS['unknown']!;
              return (
                <li key={i} className="border-l-2 border-border pl-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${meta.className}`}>
                      {meta.label}
                    </span>
                    {c.corroborating_sources ? (
                      <span className="text-[11px] text-muted-foreground">
                        {c.corroborating_sources} corroborating source
                        {c.corroborating_sources === 1 ? "" : "s"}
                      </span>
                    ) : null}
                    {c.disputed && (
                      <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400">Disputed</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-foreground">{c.text}</p>
                  {c.attribution && (
                    <p className="mt-0.5 text-xs text-muted-foreground">Attributed to: {c.attribution}</p>
                  )}
                  {c.note && <p className="mt-0.5 text-xs text-muted-foreground">{c.note}</p>}
                </li>
              );
            })}
          </ul>

          <StoryList title="Where accounts disagree" items={story.disagreements ?? []} />
          <StoryList title="Still unknown" items={story.unknowns ?? []} />
          <StoryList title="Prior context" items={story.prior_context ?? []} />

          {story.article_slugs && story.article_slugs.length > 0 && (
            <div className="mt-4">
              <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Our coverage
              </h4>
              <ul className="mt-2 space-y-1 text-sm">
                {story.article_slugs.map((s) => (
                  <li key={s}>
                    <Link
                      to="/article/$slug"
                      params={{ slug: s }}
                      className="text-primary hover:underline"
                    >
                      {s.replace(/-/g, " ")}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {story.outlets && story.outlets.length > 0 && (
            <p className="mt-4 text-xs text-muted-foreground">
              Reporting aggregated from: {story.outlets.join(", ")}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

function StoryList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-4">
      <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{title}</h4>
      <ul className="mt-2 space-y-1.5 text-sm text-foreground">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-muted-foreground">·</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GenerateInsightsButton() {
  const { user, loading } = useAuth();
  const fn = useServerFn(triggerInsightsGeneration);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => fn({ data: {} }),
    onSuccess: (r) => {
      toast.success(`Published ${r.stories} stories · ${r.claims} claims classified`);
      qc.invalidateQueries({ queryKey: ["insight-report"] });
      qc.invalidateQueries({ queryKey: ["insight-claim-mix"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Generation failed"),
  });

  if (loading || user?.email !== ADMIN_EMAIL) return null;

  return (
    <button
      onClick={() => m.mutate()}
      disabled={m.isPending}
      className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
    >
      {m.isPending ? "Auditing the week…" : "Generate insights now"}
    </button>
  );
}
