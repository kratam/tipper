import { describe, expect, it } from "vitest";
import { computePodiumUnit } from "./scoring";

describe("computePodiumUnit", () => {
  it("a pct/100 × tokenPerMatch × matchCount lefelé kerekítve", () => {
    expect(computePodiumUnit(1.5, 100, 104)).toBe(156);
    expect(computePodiumUnit(3, 100, 104)).toBe(312);
  });

  it("lefelé kerekít (Math.floor)", () => {
    expect(computePodiumUnit(1.5, 100, 5)).toBe(7); // 7.5 → 7
    expect(computePodiumUnit(1, 100, 7)).toBe(7);
  });

  it("0 pct → 0", () => {
    expect(computePodiumUnit(0, 100, 104)).toBe(0);
  });

  it("0 meccs → 0", () => {
    expect(computePodiumUnit(1.5, 100, 0)).toBe(0);
  });

  it("magasabb tokenPerMatch arányosan nagyobb egység", () => {
    expect(computePodiumUnit(1.5, 200, 104)).toBe(312);
  });
});
