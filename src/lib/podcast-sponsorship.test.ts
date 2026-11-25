import { describe, expect, it } from "vitest";
import {
  hasShowSponsorship,
  podcastSponsorRead,
  sponsorTextForSpeech,
  withSingleSponsorSection,
} from "./podcast-sponsorship";

describe("podcast sponsorship", () => {
  it("attributes sponsorship to Lovable even with no configured sponsors", () => {
    expect(podcastSponsorRead([])).toContain("This podcast is sponsored by Lovable.");
  });

  it("includes and spells the requested referral link for the broadcast", () => {
    expect(podcastSponsorRead()).toContain("https://lovable.dev/invite/ORLMPJO");
    expect(sponsorTextForSpeech(podcastSponsorRead())).toContain(
      "H T T P S, colon, slash slash, lovable dot dev, slash invite, slash O R L M P J O",
    );
  });

  it("keeps only one sponsor section after the intro, including duplicate outline reads", () => {
    const result = withSingleSponsorSection([
      { kind: "intro", title: "Welcome", beats: "" },
      { kind: "sponsors", title: "Sponsor", beats: "" },
      { kind: "segment", title: "News", beats: "" },
      { kind: "sponsors", title: "Sponsor again", beats: "" },
    ]);
    expect(result.map((s) => s.kind)).toEqual(["intro", "sponsors", "segment"]);
    expect(podcastSponsorRead([{ name: "Lovable", copy: "Another read" }]).match(/sponsored by Lovable/g)).toHaveLength(1);
  });

  it("rejects unsponsored claims and repeated show sponsorship outside the sponsor read", () => {
    expect(hasShowSponsorship("We are unsponsored this week.")).toBe(true);
    expect(hasShowSponsorship("This show is sponsored by Lovable.")).toBe(true);
    expect(hasShowSponsorship("Thanks to our sponsors.")).toBe(true);
    expect(hasShowSponsorship("The senator sponsored the legislation.")).toBe(false);
  });
});