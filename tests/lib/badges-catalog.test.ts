import { describe, expect, it } from "vitest";
import { BADGES, getBadge, tierFor } from "@/lib/badges/catalog";

describe("badge catalog", () => {
  it("has 10 unique badge keys", () => {
    expect(BADGES).toHaveLength(10);
    expect(new Set(BADGES.map((b) => b.key)).size).toBe(10);
  });

  it("tierFor returns 0 below bronze", () => {
    // biome-ignore lint/style/noNonNullAssertion: test data known to exist
    const winStreak = getBadge("win_streak")!;
    expect(tierFor(winStreak, 2)).toBe(0);
    expect(tierFor(winStreak, 3)).toBe(1);
    expect(tierFor(winStreak, 5)).toBe(2);
    expect(tierFor(winStreak, 8)).toBe(3);
    expect(tierFor(winStreak, 12)).toBe(3);
  });

  it("jackpot tiers on odds value", () => {
    // biome-ignore lint/style/noNonNullAssertion: test data known to exist
    const jackpot = getBadge("jackpot")!;
    expect(jackpot.mechanic).toBe("odds");
    expect(jackpot.minStake).toBe(100);
    expect(tierFor(jackpot, 2.9)).toBe(0);
    expect(tierFor(jackpot, 3.0)).toBe(1);
    expect(tierFor(jackpot, 6.5)).toBe(2);
    expect(tierFor(jackpot, 9.0)).toBe(3);
  });
});
