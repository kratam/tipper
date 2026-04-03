import { describe, expect, it } from "vitest";
import { calculateBetPayout, calculatePodiumPoints, get1X2 } from "@/lib/scoring";

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
  const groupSettings = { bonusGoalDiff: 5, bonusExactScore: 10 };

  it("returns 0 when 1X2 is wrong", () => {
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

  it("returns 0 when oddsAtBet is null", () => {
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
