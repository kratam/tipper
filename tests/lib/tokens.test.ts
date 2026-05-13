import { describe, expect, it } from "vitest";
import {
  calculateProjectedBalance,
  canAffordBetStake,
  computeProjectedFromCumulativeBudget,
  dateToDateNum,
  getEffectiveBudgetForBet,
  getRelevantOdds,
} from "@/lib/tokens";

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

describe("dateToDateNum", () => {
  it("encodes a UTC date as YYYYMMDD", () => {
    expect(dateToDateNum(new Date("2026-05-07T17:30:00Z"))).toBe(20260507);
    expect(dateToDateNum(new Date("2026-01-01T00:00:00Z"))).toBe(20260101);
  });
});

describe("computeProjectedFromCumulativeBudget", () => {
  // Common scenario: 6 finished + 9 future matches across 3 future days,
  // initial 200, tokenPerMatch 100. Lifetime budget = 200 + 15·100 = 1700.
  const matchDates = [
    20260502, 20260502, 20260502, 20260503, 20260503, 20260503, 20260505, 20260505, 20260505,
    20260507, 20260507, 20260507, 20260508, 20260508, 20260508,
  ];

  it("returns full daily budget for the first future day with no bets", () => {
    // Target = May 5. Constraint dates ≥ May 5 are May 5/7/8.
    //   May 5: max=200+9·100=1100, bets=0 → 1100
    //   May 7: max=200+12·100=1400, bets=0 → 1400
    //   May 8: max=200+15·100=1700, bets=0 → 1700
    // min = 1100
    expect(
      computeProjectedFromCumulativeBudget({
        initialTokens: 200,
        tokenPerMatch: 100,
        targetDateNum: 20260505,
        matchDates,
        activeBets: [],
      }),
    ).toBe(1100);
  });

  it("returns full max-by-D for May 7 with no bets", () => {
    expect(
      computeProjectedFromCumulativeBudget({
        initialTokens: 200,
        tokenPerMatch: 100,
        targetDateNum: 20260507,
        matchDates,
        activeBets: [],
      }),
    ).toBe(1400);
  });

  it("subtracts a same-day bet from available", () => {
    // 800 stake on May 7. For target May 7: max=1400, bets=800, slack=600.
    // For May 8: max=1700, bets=800, slack=900. min = 600.
    expect(
      computeProjectedFromCumulativeBudget({
        initialTokens: 200,
        tokenPerMatch: 100,
        targetDateNum: 20260507,
        matchDates,
        activeBets: [{ stake: 800, dateNum: 20260507 }],
      }),
    ).toBe(600);
  });

  it("future-day bets cap earlier-day available (the bug we fixed)", () => {
    // 800 on May 7 already placed. New bet on May 5.
    //   May 5: max=1100, bets through May 5 = 0  → 1100
    //   May 7: max=1400, bets through May 7 = 800 → 600
    //   May 8: max=1700, bets through May 8 = 800 → 900
    // min = 600  (NOT the buggy 1100)
    expect(
      computeProjectedFromCumulativeBudget({
        initialTokens: 200,
        tokenPerMatch: 100,
        targetDateNum: 20260505,
        matchDates,
        activeBets: [{ stake: 800, dateNum: 20260507 }],
      }),
    ).toBe(600);
  });

  it("returns 0 when bets exactly meet the binding cumulative budget", () => {
    // Two bets that fully consume the May-5-and-May-7 cumulative budget (1400).
    expect(
      computeProjectedFromCumulativeBudget({
        initialTokens: 200,
        tokenPerMatch: 100,
        targetDateNum: 20260505,
        matchDates,
        activeBets: [
          { stake: 800, dateNum: 20260507 },
          { stake: 600, dateNum: 20260505 },
        ],
      }),
    ).toBe(0);
  });

  it("returns negative slack when prior bets overspent the cumulative budget", () => {
    // The exact scenario the user hit: 800 on May 7 + 500 on May 5 = 1300
    // but cumulative max by May 7 is only 1400 — wait, 1300 < 1400 so May 7
    // shows 100 available. Cumulative max by May 5 is 1100, bets through
    // May 5 = 500, slack 600. So min = 100.
    expect(
      computeProjectedFromCumulativeBudget({
        initialTokens: 200,
        tokenPerMatch: 100,
        targetDateNum: 20260507,
        matchDates,
        activeBets: [
          { stake: 800, dateNum: 20260507 },
          { stake: 500, dateNum: 20260505 },
        ],
      }),
    ).toBe(100);
  });

  it("returns negative when an existing bet exceeds the cumulative budget by target day", () => {
    // 1800 bet on May 7 vs. cumulative max-by-May-7 = 1400 → slack -400
    // (May 8 cumulative max = 1700 → slack -100, but May 7 binds).
    expect(
      computeProjectedFromCumulativeBudget({
        initialTokens: 200,
        tokenPerMatch: 100,
        targetDateNum: 20260507,
        matchDates,
        activeBets: [{ stake: 1800, dateNum: 20260507 }],
      }),
    ).toBe(-400);
  });

  it("handles empty matches list (target only) gracefully", () => {
    expect(
      computeProjectedFromCumulativeBudget({
        initialTokens: 200,
        tokenPerMatch: 100,
        targetDateNum: 20260505,
        matchDates: [],
        activeBets: [],
      }),
    ).toBe(200);
  });
});

describe("getEffectiveBudgetForBet", () => {
  it("returns projected for new bet (existingStake=0)", () => {
    expect(getEffectiveBudgetForBet(500, 0)).toBe(500);
  });

  it("adds back existing stake for modification", () => {
    expect(getEffectiveBudgetForBet(0, 134)).toBe(134);
    expect(getEffectiveBudgetForBet(50, 134)).toBe(184);
  });

  it("works with negative projected (over-committed user)", () => {
    expect(getEffectiveBudgetForBet(-50, 100)).toBe(50);
  });
});

describe("canAffordBetStake", () => {
  it("allows new bet up to projected balance", () => {
    expect(canAffordBetStake(500, 0, 500)).toBe(true);
    expect(canAffordBetStake(500, 0, 1)).toBe(true);
  });

  it("rejects new bet exceeding projected balance", () => {
    expect(canAffordBetStake(500, 0, 501)).toBe(false);
  });

  // Regression: the reported bug — user modifying tip with same stake (134→134)
  // got "Insufficient token balance" because projected excludes the old stake,
  // so the check was effectively projected (0) < newStake (134).
  it("allows modifying existing bet to same stake (regression: insufficient bug)", () => {
    expect(canAffordBetStake(0, 134, 134)).toBe(true);
  });

  it("allows raising stake when effective budget supports it", () => {
    // projected=50 means after subtracting the old 134, there's 50 free.
    // Effective budget = 50 + 134 = 184 → can raise to 184.
    expect(canAffordBetStake(50, 134, 184)).toBe(true);
    expect(canAffordBetStake(50, 134, 150)).toBe(true);
  });

  it("rejects raising stake beyond effective budget", () => {
    expect(canAffordBetStake(50, 134, 185)).toBe(false);
  });

  it("allows lowering stake on existing bet", () => {
    expect(canAffordBetStake(0, 134, 50)).toBe(true);
    expect(canAffordBetStake(0, 134, 1)).toBe(true);
  });

  it("rejects new bet when projected is zero and no existing bet", () => {
    expect(canAffordBetStake(0, 0, 1)).toBe(false);
  });
});
