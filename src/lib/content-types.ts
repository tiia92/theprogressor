// Shared, client-safe metadata about article types and sections.

export type ArticleType =
  | "daily_brief"
  | "morning_headlines"
  | "evening_recap"
  | "deep_dive"
  | "explainer"
  | "timeline"
  | "weekly_roundup"
  | "news"
  | "analysis"
  | "opinion";

/**
 * The four reader-facing "kinds" of content. Every article maps to one of
 * these so readers can tell factual reporting apart from interpretation.
 */
export type ContentKind = "news" | "analysis" | "explainer" | "opinion";

export const TYPE_TO_KIND: Record<ArticleType, ContentKind> = {
  daily_brief: "news",
  morning_headlines: "news",
  evening_recap: "news",
  news: "news",
  timeline: "news",
  weekly_roundup: "analysis",
  analysis: "analysis",
  deep_dive: "explainer",
  explainer: "explainer",
  opinion: "opinion",
};

export const TYPE_LABEL: Record<ArticleType, string> = {
  daily_brief: "Daily Brief",
  morning_headlines: "Morning Headlines",
  evening_recap: "Evening Recap",
  deep_dive: "Deep Dive",
  explainer: "Explainer",
  timeline: "Timeline",
  weekly_roundup: "Weekly Roundup",
  news: "News",
  analysis: "Analysis",
  opinion: "Opinion",
};

export const KIND_LABEL: Record<ContentKind, string> = {
  news: "News",
  analysis: "Analysis",
  explainer: "Explainer",
  opinion: "Opinion",
};

export const KIND_DESCRIPTION: Record<ContentKind, string> = {
  news: "Factual summaries of what happened.",
  analysis: "Interpretation of what it means, clearly labeled.",
  explainer: "Evergreen background on the policies and institutions in play.",
  opinion: "Editorial viewpoints, explicitly identified.",
};

export const CATEGORIES = [
  { slug: "politics", label: "Politics" },
  { slug: "labor", label: "Labor" },
  { slug: "climate", label: "Climate" },
  { slug: "healthcare", label: "Healthcare" },
  { slug: "housing", label: "Housing" },
  { slug: "immigration", label: "Immigration" },
  { slug: "civil_rights", label: "Civil Rights" },
  { slug: "courts", label: "Courts" },
  { slug: "elections", label: "Elections" },
  { slug: "economy", label: "Economy" },
] as const;

export const HERO_GRADIENTS = [
  "sunrise",
  "dusk",
  "civic",
  "labor",
  "forest",
  "court",
] as const;

export type HeroGradient = (typeof HERO_GRADIENTS)[number];

export function heroGradientClass(g: string) {
  const valid = (HERO_GRADIENTS as readonly string[]).includes(g) ? g : "sunrise";
  return `hero-gradient-${valid}`;
}
