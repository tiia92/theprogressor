// Client-safe map of category -> default illustrated artwork.
// Used on the homepage when an article has no bespoke generated image.
import politics from "@/assets/topic-politics.jpg";
import labor from "@/assets/topic-labor.jpg";
import climate from "@/assets/topic-climate.jpg";
import healthcare from "@/assets/topic-healthcare.jpg";
import housing from "@/assets/topic-housing.jpg";
import immigration from "@/assets/topic-immigration.jpg";
import civilRights from "@/assets/topic-civil-rights.jpg";
import courts from "@/assets/topic-courts.jpg";
import elections from "@/assets/topic-elections.jpg";
import economy from "@/assets/topic-economy.jpg";
import fallback from "@/assets/topic-default.jpg";

const BY_CATEGORY: Record<string, string> = {
  politics,
  labor,
  climate,
  healthcare,
  housing,
  immigration,
  civil_rights: civilRights,
  courts,
  elections,
  economy,
};

export function topicArt(category?: string | null, tags?: string[] | null): string {
  if (category && BY_CATEGORY[category]) return BY_CATEGORY[category];
  for (const t of tags ?? []) {
    if (BY_CATEGORY[t]) return BY_CATEGORY[t];
  }
  return fallback;
}
