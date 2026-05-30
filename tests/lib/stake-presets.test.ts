import { describe, expect, it } from "vitest";
import { clampPerMatch, computeStakePresets } from "@/lib/stake-presets";

describe("clampPerMatch", () => {
  it("returns the per-match value when within balance", () => {
    expect(clampPerMatch(20, 100)).toBe(20);
  });

  it("caps the per-match value at the bettable balance", () => {
    expect(clampPerMatch(50, 30)).toBe(30);
  });

  it("never returns below 1", () => {
    expect(clampPerMatch(20, 0)).toBe(1);
    expect(clampPerMatch(0, 100)).toBe(1);
  });
});

describe("computeStakePresets", () => {
  it("puts the per-match chip first", () => {
    const presets = computeStakePresets(100, 4, 20, "alap");
    expect(presets[0]).toEqual({ value: 20, label: "alap", isPerMatch: true });
  });

  it("flags only the per-match chip with isPerMatch", () => {
    const presets = computeStakePresets(100, 4, 10, "alap");
    expect(presets[0].isPerMatch).toBe(true);
    for (const preset of presets.slice(1)) {
      expect(preset.isPerMatch).toBeUndefined();
    }
  });

  it("follows the per-match chip with percentage presets and MAX", () => {
    const presets = computeStakePresets(100, 4, 10, "alap");
    expect(presets).toEqual([
      { value: 10, label: "alap", isPerMatch: true },
      { value: 25, label: "25%" },
      { value: 50, label: "50%" },
      { value: 100, label: "MAX" },
    ]);
  });

  it("skips a percentage preset that duplicates the per-match value", () => {
    // evenShare for balance 100 / 4 matches = 25, which equals per-match value 25
    const presets = computeStakePresets(100, 4, 25, "alap");
    expect(presets).toEqual([
      { value: 25, label: "alap", isPerMatch: true },
      { value: 50, label: "50%" },
      { value: 100, label: "MAX" },
    ]);
  });

  it("dedupes percentage presets by value and by label", () => {
    // With matchCount 1: evenPct=100% -> doublePct also clamps to 100% (label collision),
    // and doubleShare value collides with balance/MAX value.
    const presets = computeStakePresets(50, 1, 10, "alap");
    expect(presets).toEqual([
      { value: 10, label: "alap", isPerMatch: true },
      { value: 50, label: "100%" },
    ]);
  });

  it("omits the per-match chip when its value is below 1", () => {
    const presets = computeStakePresets(100, 4, 0, "alap");
    expect(presets.some((p) => p.label === "alap")).toBe(false);
    expect(presets[0]).toEqual({ value: 25, label: "25%" });
  });
});
