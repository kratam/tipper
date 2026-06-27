import { describe, expect, it } from "vitest";
import { type BetStatInput, hitRate } from "@/lib/profile-stats";

describe("hitRate", () => {
  it("returns 0 for empty input", () => {
    expect(hitRate([])).toBe(0);
  });

  it("returns 0 when all bets are unscored (null)", () => {
    const bets: BetStatInput[] = [{ result1x2Correct: null }, { result1x2Correct: null }];
    expect(hitRate(bets)).toBe(0);
  });

  it("returns 50 for 1 correct out of 2 scored", () => {
    const bets: BetStatInput[] = [{ result1x2Correct: true }, { result1x2Correct: false }];
    expect(hitRate(bets)).toBe(50);
  });

  it("excludes null bets from denominator", () => {
    const bets: BetStatInput[] = [
      { result1x2Correct: true },
      { result1x2Correct: null }, // unscored — nem számít
      { result1x2Correct: false },
    ];
    // 1 correct / 2 scored = 50%
    expect(hitRate(bets)).toBe(50);
  });

  it("returns 100 when all scored bets are correct", () => {
    const bets: BetStatInput[] = [
      { result1x2Correct: true },
      { result1x2Correct: true },
      { result1x2Correct: null }, // unscored
    ];
    expect(hitRate(bets)).toBe(100);
  });

  it("rounds to integer", () => {
    // 1 correct / 3 scored = 33.33... → 33
    const bets: BetStatInput[] = [
      { result1x2Correct: true },
      { result1x2Correct: false },
      { result1x2Correct: false },
    ];
    expect(Number.isInteger(hitRate(bets))).toBe(true);
    expect(hitRate(bets)).toBe(33);
  });
});
