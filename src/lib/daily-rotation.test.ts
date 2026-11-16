import { describe, it, expect } from "vitest";
import { rotationKindFor } from "./daily-rotation";

describe("daily rotation", () => {
  it("cycles analysis, explainer, opinion on consecutive days", () => {
    const kinds = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"].map(rotationKindFor);
    expect(new Set(kinds.slice(0, 3)).size).toBe(3);
    expect(kinds[3]).toBe(kinds[0]);
  });
});
