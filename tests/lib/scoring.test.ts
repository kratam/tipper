import { describe, expect, it } from "vitest";
import {
  calculateBetPayout,
  calculatePodiumPoints,
  classicPointsFromFlags,
  get1X2,
} from "@/lib/scoring";

describe("get1X2", () => {
  it("returns '1' when home > away", () => {
    expect(get1X2(3, 1)).toBe("1");
  });
  it("returns 'X' when home === away", () => {
    expect(get1X2(2, 2)).toBe("X");
  });
  it("returns '2' when home < away", () => {
    expect(get1X2(1, 4)).toBe("2");
  });
});

describe("calculateBetPayout", () => {
  const groupSettings = {
    bonusGoalDiff: 5,
    bonusExactScore: 10,
    oddsBoost: 1.0,
    lossPercentage: 100,
  };

  it("loss with lossPercentage=100 returns 0 (full loss)", () => {
    const result = calculateBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 0,
      actualAway: 2,
      stake: 50,
      oddsAtBet: 2.5,
      groupSettings,
    });
    expect(result.payout).toBe(0);
    expect(result.result1x2Correct).toBe(false);
  });

  it("returns stake * odds + goal diff bonus when 1X2 and goal diff are correct", () => {
    const result = calculateBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 2,
      actualAway: 0,
      stake: 50,
      oddsAtBet: 2.5,
      groupSettings,
    });
    expect(result.payout).toBe(130); // 50*2.5 + 5 (goal diff bonus, both +2)
    expect(result.result1x2Correct).toBe(true);
    expect(result.goalDiffCorrect).toBe(true); // both +2
    expect(result.exactScoreCorrect).toBe(false);
  });

  it("adds goal diff bonus when goal difference matches", () => {
    const result = calculateBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 4,
      actualAway: 2,
      stake: 50,
      oddsAtBet: 2.5,
      groupSettings,
    });
    expect(result.payout).toBe(130); // 50*2.5 + 5
  });

  it("adds both bonuses for exact score", () => {
    const result = calculateBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 3,
      actualAway: 1,
      stake: 50,
      oddsAtBet: 2.5,
      groupSettings,
    });
    expect(result.payout).toBe(140); // 50*2.5 + 5 + 10
  });

  it("handles draws correctly", () => {
    const result = calculateBetPayout({
      predictedHome: 2,
      predictedAway: 2,
      actualHome: 3,
      actualAway: 3,
      stake: 30,
      oddsAtBet: 5.0,
      groupSettings,
    });
    expect(result.payout).toBe(155); // 30*5 + 5
    expect(result.goalDiffCorrect).toBe(true);
  });

  it("oddsAtBet null with lossPercentage=100 returns 0", () => {
    const result = calculateBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 3,
      actualAway: 1,
      stake: 50,
      oddsAtBet: null,
      groupSettings,
    });
    expect(result.payout).toBe(0);
  });

  it("applies oddsBoost to payout", () => {
    const result = calculateBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 2,
      actualAway: 0,
      stake: 100,
      oddsAtBet: 2.0,
      groupSettings: { bonusGoalDiff: 5, bonusExactScore: 10, oddsBoost: 1.5, lossPercentage: 100 },
    });
    expect(result.payout).toBe(305); // round(100 * 2.0 * 1.5) + 5 (goalDiff)
  });

  it("oddsBoost 1.0 does not change payout", () => {
    const result = calculateBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 2,
      actualAway: 0,
      stake: 50,
      oddsAtBet: 2.5,
      groupSettings: { bonusGoalDiff: 5, bonusExactScore: 10, oddsBoost: 1.0, lossPercentage: 100 },
    });
    expect(result.payout).toBe(130); // 50*2.5*1.0 + 5
  });

  it("oddsBoost does not multiply bonuses", () => {
    const result = calculateBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 3,
      actualAway: 1,
      stake: 100,
      oddsAtBet: 2.0,
      groupSettings: { bonusGoalDiff: 5, bonusExactScore: 10, oddsBoost: 1.5, lossPercentage: 100 },
    });
    // round(100 * 2.0 * 1.5) = 300, + 5 (goalDiff) + 10 (exactScore) = 315
    expect(result.payout).toBe(315);
  });

  it("oddsBoost has no effect on wrong prediction", () => {
    const result = calculateBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 0,
      actualAway: 2,
      stake: 100,
      oddsAtBet: 2.0,
      groupSettings: { bonusGoalDiff: 5, bonusExactScore: 10, oddsBoost: 2.0, lossPercentage: 100 },
    });
    expect(result.payout).toBe(0);
  });

  it("partial refund: lossPercentage=90 returns 10% of stake when 1X2 is wrong", () => {
    const result = calculateBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 0,
      actualAway: 2,
      stake: 100,
      oddsAtBet: 2.5,
      groupSettings: { bonusGoalDiff: 5, bonusExactScore: 10, oddsBoost: 1.0, lossPercentage: 90 },
    });
    expect(result.payout).toBe(10);
    expect(result.result1x2Correct).toBe(false);
    expect(result.goalDiffCorrect).toBe(false);
    expect(result.exactScoreCorrect).toBe(false);
  });

  it("partial refund: rounds to nearest integer", () => {
    const result = calculateBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 0,
      actualAway: 2,
      stake: 33,
      oddsAtBet: 2.5,
      groupSettings: { bonusGoalDiff: 5, bonusExactScore: 10, oddsBoost: 1.0, lossPercentage: 90 },
    });
    // 100 - 90 = 10; round(33 * 10 / 100) = round(3.3) = 3
    expect(result.payout).toBe(3);
  });

  it("partial refund: clamps out-of-range lossPercentage to [0, 100]", () => {
    const lossBeyond100 = calculateBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 0,
      actualAway: 2,
      stake: 100,
      oddsAtBet: 2.5,
      // 150 clamps to 100 → full loss, payout = 0 (not negative)
      groupSettings: { bonusGoalDiff: 5, bonusExactScore: 10, oddsBoost: 1.0, lossPercentage: 150 },
    });
    expect(lossBeyond100.payout).toBe(0);

    const lossBelow0 = calculateBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 0,
      actualAway: 2,
      stake: 100,
      oddsAtBet: 2.5,
      // -10 clamps to 0 → full refund, payout = stake (not greater than stake)
      groupSettings: { bonusGoalDiff: 5, bonusExactScore: 10, oddsBoost: 1.0, lossPercentage: -10 },
    });
    expect(lossBelow0.payout).toBe(100);
  });

  it("partial refund: lossPercentage=0 returns full stake on loss (full refund)", () => {
    const result = calculateBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 0,
      actualAway: 2,
      stake: 100,
      oddsAtBet: 2.5,
      groupSettings: { bonusGoalDiff: 5, bonusExactScore: 10, oddsBoost: 1.0, lossPercentage: 0 },
    });
    expect(result.payout).toBe(100);
  });

  it("partial refund: oddsAtBet null applies the same refund as a regular loss", () => {
    const result = calculateBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 3,
      actualAway: 1,
      stake: 100,
      oddsAtBet: null,
      groupSettings: { bonusGoalDiff: 5, bonusExactScore: 10, oddsBoost: 1.0, lossPercentage: 90 },
    });
    // even though the prediction is exact, oddsAtBet=null still counts as loss
    expect(result.payout).toBe(10);
    expect(result.result1x2Correct).toBe(false);
  });

  it("partial refund: correct 1X2 ignores lossPercentage entirely", () => {
    const result = calculateBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 3,
      actualAway: 1,
      stake: 50,
      oddsAtBet: 2.5,
      groupSettings: { bonusGoalDiff: 5, bonusExactScore: 10, oddsBoost: 1.0, lossPercentage: 90 },
    });
    // 50 * 2.5 + 5 (goalDiff) + 10 (exactScore) = 140
    expect(result.payout).toBe(140);
  });
});

describe("calculatePodiumPoints", () => {
  const settings = { bonusPodiumMention: 20, bonusPodiumExact: 20 };
  const actual = { gold: "team-a", silver: "team-b", bronze: "team-c" };

  it("returns 0 for no matches", () => {
    expect(
      calculatePodiumPoints(
        { gold: "team-x", silver: "team-y", bronze: "team-z" },
        actual,
        settings,
      ),
    ).toBe(0);
  });

  it("returns mention bonus for correct team wrong placement", () => {
    expect(
      calculatePodiumPoints(
        { gold: "team-c", silver: "team-x", bronze: "team-y" },
        actual,
        settings,
      ),
    ).toBe(20);
  });

  it("returns mention + exact for correct placement", () => {
    expect(
      calculatePodiumPoints(
        { gold: "team-a", silver: "team-x", bronze: "team-y" },
        actual,
        settings,
      ),
    ).toBe(40);
  });

  it("accumulates across all three", () => {
    expect(
      calculatePodiumPoints(
        { gold: "team-a", silver: "team-b", bronze: "team-c" },
        actual,
        settings,
      ),
    ).toBe(120);
  });
});

describe("classicPointsFromFlags", () => {
  it("exact score => 3", () => {
    expect(
      classicPointsFromFlags({
        result1x2Correct: true,
        goalDiffCorrect: true,
        exactScoreCorrect: true,
      }),
    ).toBe(3);
  });
  it("goal difference (not exact) => 2", () => {
    expect(
      classicPointsFromFlags({
        result1x2Correct: true,
        goalDiffCorrect: true,
        exactScoreCorrect: false,
      }),
    ).toBe(2);
  });
  it("outcome only => 1", () => {
    expect(
      classicPointsFromFlags({
        result1x2Correct: true,
        goalDiffCorrect: false,
        exactScoreCorrect: false,
      }),
    ).toBe(1);
  });
  it("wrong outcome => 0", () => {
    expect(
      classicPointsFromFlags({
        result1x2Correct: false,
        goalDiffCorrect: false,
        exactScoreCorrect: false,
      }),
    ).toBe(0);
  });
  it("unscored (null flags) => null", () => {
    expect(
      classicPointsFromFlags({
        result1x2Correct: null,
        goalDiffCorrect: null,
        exactScoreCorrect: null,
      }),
    ).toBeNull();
  });
});
