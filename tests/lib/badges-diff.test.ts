import { describe, expect, it } from "vitest";
import { diffBadge } from "@/lib/badges/evaluate";

describe("diffBadge", () => {
  it("new when no stored and tier>=1", () => {
    expect(diffBadge(undefined, { badgeKey: "x", tier: 1, value: 3, count: 3, bestValue: 3 })).toBe(
      "new",
    );
  });
  it("null when no stored and tier 0", () => {
    expect(diffBadge(undefined, { badgeKey: "x", tier: 0, value: 2, count: 2, bestValue: 2 })).toBe(
      null,
    );
  });
  it("upgraded when tier increases", () => {
    expect(
      diffBadge(
        { tier: 1, count: 3, bestValue: 3 },
        { badgeKey: "x", tier: 2, value: 5, count: 5, bestValue: 5 },
      ),
    ).toBe("upgraded");
  });
  it("null when tier unchanged", () => {
    expect(
      diffBadge(
        { tier: 2, count: 5, bestValue: 5 },
        { badgeKey: "x", tier: 2, value: 6, count: 6, bestValue: 6 },
      ),
    ).toBe(null);
  });
});
