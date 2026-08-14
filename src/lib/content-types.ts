// Shared, client-safe metadata about article types, sections, and topics.

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
  news: "Factual summaries of recent events and breaking news from Washington and beyond.",
  analysis: "Interpretation and context for what the news means, clearly labeled as analysis.",
  explainer: "Evergreen background on the policies and institutions in play.",
  opinion: "Editorial viewpoints and argument, explicitly identified as opinion journalism.",
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

/* -------------------------------------------------------------------------- */
/* Topic taxonomy                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Canonical, reader-facing topic tags. Every article is tagged with 1–4 of
 * these. Slugs are stable — they appear in URLs (/topic/$slug) and in the
 * `tags` column. Labels are shown in the UI. Kept intentionally broad so a
 * reader can browse by interest area.
 */
export const TOPICS = [
  { slug: "us_politics", label: "U.S. Politics", description: "The White House, Congress, and the daily grind of American governance." },
  { slug: "elections", label: "Elections", description: "Campaigns, voting rights, redistricting, and how power is contested." },
  { slug: "courts", label: "Courts", description: "The Supreme Court, federal benches, and the fights that reshape the law." },
  { slug: "immigration", label: "Immigration", description: "Border policy, ICE, asylum, and the lives of people caught in between." },
  { slug: "civil_rights", label: "Civil Rights", description: "Voting, protest, speech, and the ongoing struggle for equal protection." },
  { slug: "race", label: "Race & Justice", description: "Racial equity, discrimination, and how policy plays out unevenly." },
  { slug: "lgbtq", label: "LGBTQ+", description: "Queer and trans rights, health, and community." },
  { slug: "reproductive_rights", label: "Reproductive Rights", description: "Abortion access, contraception, and bodily autonomy." },
  { slug: "gender", label: "Gender", description: "Gender equity, pay gaps, and gender-based violence." },
  { slug: "labor", label: "Labor", description: "Unions, wages, working conditions, and worker power." },
  { slug: "economy", label: "Economy", description: "Inflation, growth, inequality, and who the economy actually works for." },
  { slug: "housing", label: "Housing", description: "Rent, homelessness, zoning, and the affordability crunch." },
  { slug: "healthcare", label: "Healthcare", description: "Coverage, costs, Medicare and Medicaid, and access to care." },
  { slug: "public_health", label: "Public Health", description: "Disease, safety, vaccines, and community wellbeing." },
  { slug: "education", label: "Education", description: "Public schools, universities, curriculum fights, and student debt." },
  { slug: "climate", label: "Climate", description: "The climate crisis, adaptation, and the transition off fossil fuels." },
  { slug: "environment", label: "Environment", description: "Pollution, wildlife, land use, and environmental justice." },
  { slug: "energy", label: "Energy", description: "The grid, oil and gas, renewables, and energy prices." },
  { slug: "tech", label: "Tech", description: "Big Tech, platforms, privacy, and the internet." },
  { slug: "ai", label: "AI", description: "Artificial intelligence, its promises, its harms, and its regulation." },
  { slug: "media", label: "Media", description: "Press freedom, disinformation, and the business of news." },
  { slug: "criminal_justice", label: "Criminal Justice", description: "Policing, prisons, prosecution, and reform." },
  { slug: "guns", label: "Guns", description: "Gun violence, gun laws, and the politics of the Second Amendment." },
  { slug: "foreign_policy", label: "Foreign Policy", description: "How the U.S. acts abroad — diplomacy, aid, sanctions, and force." },
  { slug: "international", label: "International", description: "News from outside the U.S. that shapes the wider world." },
  { slug: "war", label: "War & Conflict", description: "Wars, occupations, and the humanitarian fallout." },
  { slug: "science", label: "Science", description: "Research, discovery, and how science shapes policy." },
  { slug: "pop_culture", label: "Pop Culture", description: "Music, film, TV, celebrity, and the culture we argue about." },
  { slug: "sports", label: "Sports", description: "The occasional sports story, usually where it meets money or politics." },
  { slug: "religion", label: "Religion", description: "Faith, secularism, and religion in public life." },
] as const;

export type TopicSlug = (typeof TOPICS)[number]["slug"];

export const TOPIC_SLUGS: readonly string[] = TOPICS.map((t) => t.slug);

export const TOPIC_LABEL: Record<string, string> = Object.fromEntries(
  TOPICS.map((t) => [t.slug, t.label]),
);

export function findTopic(slug: string) {
  return TOPICS.find((t) => t.slug === slug);
}

/** Normalize a free-form tag to a canonical topic slug, if possible. */
const TOPIC_ALIASES: Record<string, TopicSlug> = {
  politics: "us_politics",
  "u.s. politics": "us_politics",
  "us politics": "us_politics",
  democracy: "us_politics",
  federalism: "us_politics",
  congress: "us_politics",
  "trump administration": "us_politics",
  "voting rights": "elections",
  election: "elections",
  campaign: "elections",
  scotus: "courts",
  "supreme court": "courts",
  law: "courts",
  lawsuit: "courts",
  lawsuits: "courts",
  "constitutional law": "courts",
  ice: "immigration",
  border: "immigration",
  asylum: "immigration",
  "civil liberties": "civil_rights",
  "first amendment": "civil_rights",
  "civil rights": "civil_rights",
  "racial justice": "race",
  "hate crimes": "race",
  queer: "lgbtq",
  trans: "lgbtq",
  abortion: "reproductive_rights",
  union: "labor",
  unions: "labor",
  wages: "labor",
  "labor rights": "labor",
  workers: "labor",
  economics: "economy",
  inflation: "economy",
  tariffs: "economy",
  trade: "economy",
  "trade policy": "economy",
  manufacturing: "economy",
  antitrust: "economy",
  "corporate power": "economy",
  "consumer rights": "economy",
  monopoly: "economy",
  rent: "housing",
  homelessness: "housing",
  zoning: "housing",
  medicare: "healthcare",
  medicaid: "healthcare",
  fda: "public_health",
  "public health": "public_health",
  "food safety": "public_health",
  policing: "criminal_justice",
  "police reform": "criminal_justice",
  prison: "criminal_justice",
  prisons: "criminal_justice",
  "criminal justice": "criminal_justice",
  forensics: "criminal_justice",
  "due process": "criminal_justice",
  accountability: "criminal_justice",
  "public safety": "criminal_justice",
  nypd: "criminal_justice",
  gun: "guns",
  firearm: "guns",
  "climate change": "climate",
  "tropical storms": "climate",
  disaster: "climate",
  "disaster relief": "climate",
  fema: "climate",
  infrastructure: "climate",
  pollution: "environment",
  wildlife: "environment",
  sustainability: "environment",
  oil: "energy",
  gas: "energy",
  renewables: "energy",
  school: "education",
  schools: "education",
  university: "education",
  student: "education",
  technology: "tech",
  "big tech": "tech",
  cybersecurity: "tech",
  privacy: "tech",
  "digital privacy": "tech",
  "right to repair": "tech",
  bloatware: "tech",
  google: "tech",
  alphabet: "tech",
  samsung: "tech",
  "openai": "ai",
  regulation: "us_politics",
  "media consolidation": "media",
  "media-consolidation": "media",
  press: "media",
  journalism: "media",
  paramount: "media",
  "warner bros": "media",
  briefing: "us_politics",
  summary: "us_politics",
  "morning headlines": "us_politics",
  "state rights": "us_politics",
  minnesota: "us_politics",
  wisconsin: "us_politics",
  "north carolina": "us_politics",
  madison: "us_politics",
  "new york city": "us_politics",
  smithsonian: "us_politics",
  history: "us_politics",
  culture: "pop_culture",
  celebrity: "pop_culture",
  film: "pop_culture",
  music: "pop_culture",
  tv: "pop_culture",
  d4vd: "pop_culture",
  mlb: "sports",
  nba: "sports",
  nfl: "sports",
  "sports economy": "sports",
  "trade deadline": "sports",
  ukraine: "war",
  gaza: "war",
  israel: "international",
  china: "international",
  russia: "international",
};

export function normalizeTagsToTopics(rawTags: readonly string[]): TopicSlug[] {
  const out = new Set<TopicSlug>();
  for (const raw of rawTags) {
    if (!raw) continue;
    const key = raw.toLowerCase().trim();
    if ((TOPIC_SLUGS as readonly string[]).includes(key)) {
      out.add(key as TopicSlug);
      continue;
    }
    const alias = TOPIC_ALIASES[key];
    if (alias) out.add(alias);
  }
  return Array.from(out);
}
