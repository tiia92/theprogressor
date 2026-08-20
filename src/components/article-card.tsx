import { Link } from "@tanstack/react-router";
import type { ArticleType, ContentKind } from "@/lib/content-types";
import { KIND_LABEL, TYPE_LABEL, TYPE_TO_KIND, TOPIC_LABEL, heroGradientClass } from "@/lib/content-types";
import { topicArt } from "@/lib/topic-art";

interface Props {
  article: {
    slug: string;
    title: string;
    dek: string;
    article_type: string;
    category: string;
    tags?: string[] | null;
    hero_gradient: string;
    hero_image_url?: string | null;
    published_at: string;
  };
  size?: "featured" | "medium" | "compact";
  /** Homepage-only: show illustrated artwork instead of the gradient block. */
  withArt?: boolean;
  /** Section pages: omit the photo/gradient block to avoid empty visual space. */
  noImage?: boolean;
  /** Semantic heading level for the article title. Listing pages use h2 under the page h1. */
  headingLevel?: "h2" | "h3";
}

function HeroArt({
  article,
  ratio,
  priority,
}: {
  article: Props["article"];
  ratio: string;
  priority?: boolean;
}) {
  const src = article.hero_image_url || topicArt(article.category, article.tags);
  return (
    <img
      src={src}
      alt=""
      width={1024}
      height={576}
      loading={priority ? "eager" : "lazy"}
      className={`${ratio} w-full object-cover`}
    />
  );
}

function TopicChips({ tags, max = 3 }: { tags?: string[] | null; max?: number }) {
  const shown = (tags ?? []).filter((t) => TOPIC_LABEL[t]).slice(0, max);
  if (shown.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((t) => (
        <span
          key={t}
          className="rounded-full border border-border bg-background/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
        >
          {TOPIC_LABEL[t]}
        </span>
      ))}
    </div>
  );
}

const KIND_CLASS: Record<ContentKind, string> = {
  news: "text-[color:var(--label-news)] border-[color:var(--label-news)]/40 bg-[color:var(--label-news)]/8",
  analysis: "text-[color:var(--label-analysis)] border-[color:var(--label-analysis)]/40 bg-[color:var(--label-analysis)]/8",
  explainer: "text-[color:var(--label-explainer)] border-[color:var(--label-explainer)]/40 bg-[color:var(--label-explainer)]/8",
  opinion: "text-[color:var(--label-opinion)] border-[color:var(--label-opinion)]/40 bg-[color:var(--label-opinion)]/10",
};

export function KindBadge({ type }: { type: string }) {
  const kind = TYPE_TO_KIND[type as ArticleType] ?? "news";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] ${KIND_CLASS[kind]}`}
    >
      {KIND_LABEL[kind]}
    </span>
  );
}

export function TypeLabel({ type }: { type: string }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
      {TYPE_LABEL[type as ArticleType] ?? type}
    </span>
  );
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Deterministic (UTC, fixed locale) so SSR and client markup match.
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function ArticleCard({ article, size = "medium", withArt = false, noImage = false, headingLevel = "h3" }: Props) {
  if (size === "featured") {
    return (
      <Link
        to="/article/$slug"
        params={{ slug: article.slug }}
        className="group block overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-lg"
      >
        {withArt ? (
          <HeroArt article={article} ratio="aspect-[16/8]" priority />
        ) : (
          <div className={`aspect-[16/8] w-full ${heroGradientClass(article.hero_gradient)}`} />
        )}
        <div className="p-6">
          <div className="mb-3 flex items-center gap-2">
            <KindBadge type={article.article_type} />
            <TypeLabel type={article.article_type} />
            <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {fmtDate(article.published_at)}
            </span>
          </div>
          <h2 className="font-heading text-2xl font-semibold leading-tight text-foreground group-hover:text-primary md:text-3xl">
            {article.title}
          </h2>
          <p className="mt-3 text-base text-muted-foreground md:text-lg">{article.dek}</p>
          <div className="mt-4"><TopicChips tags={article.tags} max={4} /></div>
        </div>
      </Link>
    );
  }

  if (size === "compact") {
    const CompactTag = headingLevel;
    return (
      <Link
        to="/article/$slug"
        params={{ slug: article.slug }}
        className="group flex flex-col gap-1 border-b border-border pb-3"
      >
        <div className="flex items-center gap-2">
          <KindBadge type={article.article_type} />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {fmtDate(article.published_at)}
          </span>
        </div>
        <CompactTag className="font-heading text-lg font-semibold leading-snug text-foreground group-hover:text-primary">
          {article.title}
        </CompactTag>
      </Link>
    );
  }

  const TitleTag = headingLevel;
  return (
    <Link
      to="/article/$slug"
      params={{ slug: article.slug }}
      className="group block overflow-hidden rounded-md border border-border bg-card transition-shadow hover:shadow-md"
    >
      {!noImage && (
        withArt ? (
          <HeroArt article={article} ratio="aspect-[16/9]" />
        ) : (
          <div className={`aspect-[16/9] w-full ${heroGradientClass(article.hero_gradient)}`} />
        )
      )}
      <div className="p-5">
        <div className="mb-2 flex items-center gap-2">
          <KindBadge type={article.article_type} />
          <TypeLabel type={article.article_type} />
        </div>
        <TitleTag className="font-heading text-xl font-semibold leading-snug text-foreground group-hover:text-primary">
          {article.title}
        </TitleTag>
        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{article.dek}</p>
        <div className="mt-3"><TopicChips tags={article.tags} max={3} /></div>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {fmtDate(article.published_at)}
        </p>
      </div>
    </Link>
  );
}
