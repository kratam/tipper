import { describe, expect, it } from "vitest";
import { clampPerMatch, computeStakePresets } from "./stake-presets";

describe("clampPerMatch", () => {
  it("balance-ra vágja a meccsenkénti keretet", () => {
    expect(clampPerMatch(100, 31)).toBe(31);
  });

  it("legalább 1-et ad vissza", () => {
    expect(clampPerMatch(10, 0)).toBe(1);
  });

  it("nem vág, ha belefér", () => {
    expect(clampPerMatch(10, 100)).toBe(10);
  });
});

describe("computeStakePresets", () => {
  it("soha nem ad balance fölötti preset értéket (1 meccses nap)", () => {
    // Repro: Tippelhető 31, 1 tippeletlen meccs aznap → a dupla rész 62 volt
    const presets = computeStakePresets(31, 1, 31, "perMatch");
    for (const preset of presets) {
      expect(preset.value).toBeLessThanOrEqual(31);
    }
  });

  it("balance = perMatch és 1 meccs esetén egyetlen chip marad", () => {
    const presets = computeStakePresets(31, 1, 31, "perMatch");
    expect(presets).toEqual([{ value: 31, label: "perMatch", isPerMatch: true }]);
  });

  it("normál eset: perMatch + egyenlő + dupla + MAX", () => {
    const presets = computeStakePresets(1444, 5, 100, "perMatch");
    expect(presets).toEqual([
      { value: 100, label: "perMatch", isPerMatch: true },
      { value: 288, label: "20%" },
      { value: 577, label: "40%" },
      { value: 1444, label: "MAX" },
    ]);
  });

  it("1 meccs, kisebb perMatch: a 100% chip a teljes balance-szal jelenik meg", () => {
    const presets = computeStakePresets(31, 1, 10, "perMatch");
    expect(presets).toEqual([
      { value: 10, label: "perMatch", isPerMatch: true },
      { value: 31, label: "100%" },
    ]);
  });

  it("azonos érték/címke dedupolódik", () => {
    // 2 meccs: even 50%=15, double 100%=31=MAX → MAX kiesik érték-dedup miatt
    const presets = computeStakePresets(31, 2, 5, "perMatch");
    expect(presets).toEqual([
      { value: 5, label: "perMatch", isPerMatch: true },
      { value: 15, label: "50%" },
      { value: 31, label: "100%" },
    ]);
  });
});
