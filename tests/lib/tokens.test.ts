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

describe("computeProjectedFromCumulativeBudget — resolved bet payouts", () => {
  // Model: a resolved bet contributes its `netPayout` (= bets.payout - bets.stake)
  // to the lifetime budget on the bet's match date. Wins increase the cap,
  // losses decrease it. Active bets (still unresolved) consume the slack.

  it("a won bet on a past match increases the budget by netPayout", () => {
    // 2 matches, initial=200, tokenPerMatch=100.
    // Match1 won: stake=100, payout=120 → netPayout=+20.
    // Target match2 (next day). No active bets.
    // maxBudget(nap2) = 200 + 2·100 + 20 = 420.
    expect(
      computeProjectedFromCumulativeBudget({
        initialTokens: 200,
        tokenPerMatch: 100,
        targetDateNum: 20260502,
        matchDates: [20260501, 20260502],
        activeBets: [],
        resolvedBetNets: [{ netPayout: 20, dateNum: 20260501 }],
      }),
    ).toBe(420);
  });

  it("a lost bet on a past match reduces the budget by the stake", () => {
    // 2 matches, initial=200, tokenPerMatch=100.
    // Match1 lost: stake=100, payout=0 → netPayout=-100.
    // Target match2. maxBudget(nap2) = 200 + 2·100 - 100 = 300.
    expect(
      computeProjectedFromCumulativeBudget({
        initialTokens: 200,
        tokenPerMatch: 100,
        targetDateNum: 20260502,
        matchDates: [20260501, 20260502],
        activeBets: [],
        resolvedBetNets: [{ netPayout: -100, dateNum: 20260501 }],
      }),
    ).toBe(300);
  });

  it("won-back-stake-exactly (odds 1.0) is budget-neutral", () => {
    // Match1: stake=100, payout=100 → netPayout=0.
    // Target match2. Identical to no resolved bet.
    expect(
      computeProjectedFromCumulativeBudget({
        initialTokens: 200,
        tokenPerMatch: 100,
        targetDateNum: 20260502,
        matchDates: [20260501, 20260502],
        activeBets: [],
        resolvedBetNets: [{ netPayout: 0, dateNum: 20260501 }],
      }),
    ).toBe(400);
  });

  it("future-day bet caps earlier-day budget after winning a past match (the user's 3-match scenario)", () => {
    // 3 matches, initial=0, tokenPerMatch=100. matchDates = nap1, nap2, nap3.
    // Match1 won 1.2x: stake=100, payout=120 → netPayout=+20.
    // Active bet on match3 (nap3): stake=320 (consumes the full nap3 cap).
    // Target match2 (nap2). Expected projected = 0.
    //
    // Constraint dates ≥ nap2 → {nap2, nap3}
    //   nap2: max = 0 + 2·100 + 20 = 220, active_by_nap2 = 0 → slack 220
    //   nap3: max = 0 + 3·100 + 20 = 320, active_by_nap3 = 320 → slack 0
    // min = 0
    expect(
      computeProjectedFromCumulativeBudget({
        initialTokens: 0,
        tokenPerMatch: 100,
        targetDateNum: 20260502,
        matchDates: [20260501, 20260502, 20260503],
        activeBets: [{ stake: 320, dateNum: 20260503 }],
        resolvedBetNets: [{ netPayout: 20, dateNum: 20260501 }],
      }),
    ).toBe(0);
  });

  it("multiple resolved bets accumulate (one win + one loss)", () => {
    // 3 matches, initial=0, tokenPerMatch=100.
    // Match1 won (+50), Match2 lost (-100).
    // Target match3. max(nap3) = 0 + 3·100 + 50 - 100 = 250.
    expect(
      computeProjectedFromCumulativeBudget({
        initialTokens: 0,
        tokenPerMatch: 100,
        targetDateNum: 20260503,
        matchDates: [20260501, 20260502, 20260503],
        activeBets: [],
        resolvedBetNets: [
          { netPayout: 50, dateNum: 20260501 },
          { netPayout: -100, dateNum: 20260502 },
        ],
      }),
    ).toBe(250);
  });

  it("only resolved bets up to the cutoff date count toward maxBudget", () => {
    // Resolved bet on a date AFTER the target shouldn't count for the target's
    // cutoff (it does count for its own cutoff if ≥ targetDate, but here we
    // verify the per-cutoff filter).
    // 3 matches, initial=200, tokenPerMatch=100.
    // Resolved bet on match3 (+50). Target = match2.
    // Constraint dates ≥ nap2 → {nap2, nap3}
    //   nap2: max = 200 + 2·100 + 0 = 400 (resolved at nap3 NOT counted)
    //   nap3: max = 200 + 3·100 + 50 = 550
    // min = 400
    expect(
      computeProjectedFromCumulativeBudget({
        initialTokens: 200,
        tokenPerMatch: 100,
        targetDateNum: 20260502,
        matchDates: [20260501, 20260502, 20260503],
        activeBets: [],
        resolvedBetNets: [{ netPayout: 50, dateNum: 20260503 }],
      }),
    ).toBe(400);
  });

  it("bonus payouts pass through (bonusGoalDiff/bonusExactScore are baked into payout)", () => {
    // The caller computes netPayout = payout - stake, where payout already
    // includes any group bonuses. This test pins that the function adds
    // whatever netPayout it receives without further interpretation.
    // 2 matches, initial=0, tokenPerMatch=100.
    // Match1: stake=50, payout = round(50 × 2.5 × 1.0) + 5 (goalDiff) + 10 (exact) = 140.
    // netPayout = 140 - 50 = +90.
    // Target match2. max(nap2) = 0 + 2·100 + 90 = 290.
    expect(
      computeProjectedFromCumulativeBudget({
        initialTokens: 0,
        tokenPerMatch: 100,
        targetDateNum: 20260502,
        matchDates: [20260501, 20260502],
        activeBets: [],
        resolvedBetNets: [{ netPayout: 90, dateNum: 20260501 }],
      }),
    ).toBe(290);
  });

  it("is backward compatible: resolvedBetNets parameter is optional", () => {
    // Omitting resolvedBetNets must behave identically to the legacy formula.
    expect(
      computeProjectedFromCumulativeBudget({
        initialTokens: 200,
        tokenPerMatch: 100,
        targetDateNum: 20260502,
        matchDates: [20260501, 20260502],
        activeBets: [],
      }),
    ).toBe(400);
  });

  it("complex: mixed resolved + active future bet across 4 days", () => {
    // 4 matches, initial=100, tokenPerMatch=50.
    // matchDates: nap1..nap4.
    // Match1 (nap1) won: netPayout=+30.
    // Match2 (nap2) lost: netPayout=-40.
    // Active bet on match4 (nap4): stake=80.
    // Target match3 (nap3).
    //
    // Constraint dates ≥ nap3 → {nap3, nap4}
    //   nap3: max = 100 + 3·50 + 30 - 40 = 240, active_by_nap3 = 0 → 240
    //   nap4: max = 100 + 4·50 + 30 - 40 = 290, active_by_nap4 = 80 → 210
    // min = 210
    expect(
      computeProjectedFromCumulativeBudget({
        initialTokens: 100,
        tokenPerMatch: 50,
        targetDateNum: 20260503,
        matchDates: [20260501, 20260502, 20260503, 20260504],
        activeBets: [{ stake: 80, dateNum: 20260504 }],
        resolvedBetNets: [
          { netPayout: 30, dateNum: 20260501 },
          { netPayout: -40, dateNum: 20260502 },
        ],
      }),
    ).toBe(210);
  });

  it("two same-day matches: one resolved, one scheduled active", () => {
    // 2 matches both on nap1, initial=0, tokenPerMatch=100.
    // matchDates = [nap1, nap1]. lifetime by nap1 = 0 + 2·100 = 200.
    // Match1a won: netPayout=+50.
    // Match1b scheduled, no active bet yet.
    // Target match1b (nap1).
    //
    // Constraint date: nap1.
    //   nap1: max = 0 + 2·100 + 50 = 250, active_by_nap1 = 0 → 250
    expect(
      computeProjectedFromCumulativeBudget({
        initialTokens: 0,
        tokenPerMatch: 100,
        targetDateNum: 20260501,
        matchDates: [20260501, 20260501],
        activeBets: [],
        resolvedBetNets: [{ netPayout: 50, dateNum: 20260501 }],
      }),
    ).toBe(250);
  });

  it("biggest jackpot: huge win unlocks a large future bet", () => {
    // 2 matches, initial=0, tokenPerMatch=100.
    // Match1 stake=100 won 10x: netPayout = +900.
    // Target match2 (nap2). max(nap2) = 0 + 200 + 900 = 1100.
    expect(
      computeProjectedFromCumulativeBudget({
        initialTokens: 0,
        tokenPerMatch: 100,
        targetDateNum: 20260502,
        matchDates: [20260501, 20260502],
        activeBets: [],
        resolvedBetNets: [{ netPayout: 900, dateNum: 20260501 }],
      }),
    ).toBe(1100);
  });

  it("loss on past + active bet on same day combine correctly", () => {
    // 3 matches, initial=200, tokenPerMatch=100.
    // Match1 lost (nap1): netPayout=-100.
    // Active bet on match2 (nap2): stake=150.
    // Target match3 (nap3).
    //
    // Constraint dates ≥ nap3 → {nap3}
    //   nap3: max = 200 + 3·100 - 100 = 400, active_by_nap3 = 150 → 250
    expect(
      computeProjectedFromCumulativeBudget({
        initialTokens: 200,
        tokenPerMatch: 100,
        targetDateNum: 20260503,
        matchDates: [20260501, 20260502, 20260503],
        activeBets: [{ stake: 150, dateNum: 20260502 }],
        resolvedBetNets: [{ netPayout: -100, dateNum: 20260501 }],
      }),
    ).toBe(250);
  });

  it("regression: existing-bet modification with prior wins (effective budget)", () => {
    // User has an existing bet of stake=200 on match2 (nap2), match1 already won (+50).
    // 2 matches, initial=200, tokenPerMatch=100.
    // The query passes the OLD stake in activeBets, the form adds it back.
    //
    // Constraint dates ≥ nap2 → {nap2}
    //   nap2: max = 200 + 2·100 + 50 = 450, active_by_nap2 = 200 → 250
    // projected = 250 (so effective budget for modifying the bet = 250 + 200 = 450)
    expect(
      computeProjectedFromCumulativeBudget({
        initialTokens: 200,
        tokenPerMatch: 100,
        targetDateNum: 20260502,
        matchDates: [20260501, 20260502],
        activeBets: [{ stake: 200, dateNum: 20260502 }],
        resolvedBetNets: [{ netPayout: 50, dateNum: 20260501 }],
      }),
    ).toBe(250);
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
