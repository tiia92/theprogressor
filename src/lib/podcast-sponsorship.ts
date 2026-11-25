export const PODCAST_SPONSOR_URL = "https://lovable.dev/invite/ORLMPJO";
export const PODCAST_SPONSOR_SPOKEN_URL =
  "H T T P S, colon, slash slash, lovable dot dev, slash invite, slash O R L M P J O";

interface Sponsor {
  name: string;
  copy: string;
  link?: string | null;
}

export interface PodcastSection {
  kind: string;
  title: string;
  beats: string;
}

/** Keep the sponsor read deterministic and isolated from AI-written sections. */
export function podcastSponsorRead(sponsors: Sponsor[] = []): string {
  const additional = sponsors
    .filter((s) => !/lovable/i.test(s.name) && s.link !== PODCAST_SPONSOR_URL)
    .map((s) => `${s.name}. ${s.copy}${s.link ? ` Visit ${s.link}.` : ""}`);
  return [
    `This podcast is sponsored by Lovable. Visit ${PODCAST_SPONSOR_URL}.`,
    ...additional,
  ].join(" ");
}

export function withSingleSponsorSection(sections: PodcastSection[]): PodcastSection[] {
  const editorial = sections.filter((s) => !/sponsor|advert|\bad\b/i.test(`${s.kind} ${s.title}`)).slice(0, 9);
  const introIndex = editorial.findIndex((s) => s.kind === "intro");
  const insertionIndex = introIndex >= 0 ? introIndex + 1 : editorial[0]?.kind === "cold_open" ? 1 : 0;
  editorial.splice(insertionIndex, 0, { kind: "sponsors", title: "Sponsor read", beats: "" });
  return editorial;
}

/** Reject duplicate show-sponsorship discussion, not news about sponsored legislation. */
export function hasShowSponsorship(text: string): boolean {
  return /\b(?:unsponsored|sponsor(?:ship)?[- ]free|no sponsors?|our sponsors?|this week'?s sponsors?|(?:show|podcast|episode|we)\b[^.!?\n]{0,80}\b(?:sponsor\w*|funded|supported by)|(?:sponsor\w*|brought to you by)\b[^.!?\n]{0,80}\b(?:show|podcast|episode|us))\b|lovable|ORLMPJO/i.test(text);
}

export function sponsorTextForSpeech(text: string): string {
  return text.replaceAll(PODCAST_SPONSOR_URL, PODCAST_SPONSOR_SPOKEN_URL);
}