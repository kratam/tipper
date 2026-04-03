import { describe, expect, it } from "vitest";
import { calculateCarryover, getRelevantOdds } from "@/lib/tokens";

describe("calculateCarryover", () => {
  it("returns 50% rounded down", () => {
    expect(calculateCarryover(75, 50)).toBe(37);
  });
  it("returns 0 when all used", () => {
    expect(calculateCarryover(0, 50)).toBe(0);
  });
  it("rounds down odd numbers", () => {
    expect(calculateCarryover(3, 50)).toBe(1);
  });
  it("handles 0% carryover", () => {
    expect(calculateCarryover(100, 0)).toBe(0);
  });
  it("handles 100% carryover", () => {
    expect(calculateCarryover(100, 100)).toBe(100);
  });
});

describe("getRelevantOdds", () => {
  const odds = { homeOdds: "1.5", drawOdds: "4.0", awayOdds: "6.0" };
  it("returns home odds for home win", () => {
    expect(getRelevantOdds(3, 1, odds)).toBe(1.5);
  });
  it("returns draw odds for draw", () => {
    expect(getRelevantOdds(2, 2, odds)).toBe(4.0);
  });
  it("returns away odds for away win", () => {
    expect(getRelevantOdds(0, 3, odds)).toBe(6.0);
  });
});
