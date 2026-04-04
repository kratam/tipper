import { describe, expect, it } from "vitest";
import { calculateProjectedBalance, getRelevantOdds } from "@/lib/tokens";

describe("calculateProjectedBalance", () => {
  it("returns actual balance when no pending distributions", () => {
    expect(
      calculateProjectedBalance({
        actualBalance: 100,
        pendingDistributions: 0,
        tokenPerMatch: 100,
      }),
    ).toBe(100);
  });

  it("adds pending distributions to balance", () => {
    expect(
      calculateProjectedBalance({
        actualBalance: 100,
        pendingDistributions: 3,
        tokenPerMatch: 100,
      }),
    ).toBe(400);
  });

  it("works with negative balance (user pre-committed tokens)", () => {
    expect(
      calculateProjectedBalance({
        actualBalance: -50,
        pendingDistributions: 3,
        tokenPerMatch: 100,
      }),
    ).toBe(250);
  });

  it("returns 0 when balance is zero and no pending", () => {
    expect(
      calculateProjectedBalance({
        actualBalance: 0,
        pendingDistributions: 0,
        tokenPerMatch: 100,
      }),
    ).toBe(0);
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
