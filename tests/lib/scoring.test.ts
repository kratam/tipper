import { describe, expect, it } from "vitest";
import {
  calculateBaseBetPayout,
  calculatePodiumPoints,
  classicPointsFromFlags,
  computePoolBase,
  distributeBonusPools,
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

describe("calculateBaseBetPayout", () => {
  it("loss with lossPercentage=100 returns 0 (full loss)", () => {
    const r = calculateBaseBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 0,
      actualAway: 2,
      stake: 50,
      oddsAtBet: 2.5,
      oddsBoost: 1.0,
      lossPercentage: 100,
    });
    expect(r.basePayout).toBe(0);
    expect(r.result1x2Correct).toBe(false);
  });

  it("returns stake * odds and flags goal diff when 1X2 and goal diff are correct", () => {
    const r = calculateBaseBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 2,
      actualAway: 0,
      stake: 50,
      oddsAtBet: 2.5,
      oddsBoost: 1.0,
      lossPercentage: 100,
    });
    expect(r.basePayout).toBe(125); // 50*2.5 (bónusz külön fázisban)
    expect(r.result1x2Correct).toBe(true);
    expect(r.goalDiffCorrect).toBe(true);
    expect(r.exactScoreCorrect).toBe(false);
  });

  it("flags exact score", () => {
    const r = calculateBaseBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 3,
      actualAway: 1,
      stake: 50,
      oddsAtBet: 2.5,
      oddsBoost: 1.0,
      lossPercentage: 100,
    });
    expect(r.basePayout).toBe(125);
    expect(r.goalDiffCorrect).toBe(true);
    expect(r.exactScoreCorrect).toBe(true);
  });

  it("handles draws correctly", () => {
    const r = calculateBaseBetPayout({
      predictedHome: 2,
      predictedAway: 2,
      actualHome: 3,
      actualAway: 3,
      stake: 30,
      oddsAtBet: 5.0,
      oddsBoost: 1.0,
      lossPercentage: 100,
    });
    expect(r.basePayout).toBe(150); // 30*5
    expect(r.goalDiffCorrect).toBe(true);
  });

  it("oddsAtBet null with lossPercentage=100 returns 0", () => {
    const r = calculateBaseBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 3,
      actualAway: 1,
      stake: 50,
      oddsAtBet: null,
      oddsBoost: 1.0,
      lossPercentage: 100,
    });
    expect(r.basePayout).toBe(0);
  });

  it("applies oddsBoost to the base payout", () => {
    const r = calculateBaseBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 2,
      actualAway: 0,
      stake: 100,
      oddsAtBet: 2.0,
      oddsBoost: 1.5,
      lossPercentage: 100,
    });
    expect(r.basePayout).toBe(300); // round(100 * 2.0 * 1.5)
    expect(r.goalDiffCorrect).toBe(true);
  });

  it("oddsBoost has no effect on wrong prediction", () => {
    const r = calculateBaseBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 0,
      actualAway: 2,
      stake: 100,
      oddsAtBet: 2.0,
      oddsBoost: 2.0,
      lossPercentage: 100,
    });
    expect(r.basePayout).toBe(0);
  });

  it("partial refund: lossPercentage=90 returns 10% of stake when 1X2 is wrong", () => {
    const r = calculateBaseBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 0,
      actualAway: 2,
      stake: 100,
      oddsAtBet: 2.5,
      oddsBoost: 1.0,
      lossPercentage: 90,
    });
    expect(r.basePayout).toBe(10);
    expect(r.result1x2Correct).toBe(false);
    expect(r.goalDiffCorrect).toBe(false);
    expect(r.exactScoreCorrect).toBe(false);
  });

  it("partial refund: rounds to nearest integer", () => {
    const r = calculateBaseBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 0,
      actualAway: 2,
      stake: 33,
      oddsAtBet: 2.5,
      oddsBoost: 1.0,
      lossPercentage: 90,
    });
    // 100 - 90 = 10; round(33 * 10 / 100) = round(3.3) = 3
    expect(r.basePayout).toBe(3);
  });

  it("partial refund: clamps out-of-range lossPercentage to [0, 100]", () => {
    const lossBeyond100 = calculateBaseBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 0,
      actualAway: 2,
      stake: 100,
      oddsAtBet: 2.5,
      oddsBoost: 1.0,
      lossPercentage: 150, // clamps to 100 → full loss, 0 (not negative)
    });
    expect(lossBeyond100.basePayout).toBe(0);

    const lossBelow0 = calculateBaseBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 0,
      actualAway: 2,
      stake: 100,
      oddsAtBet: 2.5,
      oddsBoost: 1.0,
      lossPercentage: -10, // clamps to 0 → full refund, = stake
    });
    expect(lossBelow0.basePayout).toBe(100);
  });

  it("partial refund: oddsAtBet null applies the same refund as a regular loss", () => {
    const r = calculateBaseBetPayout({
      predictedHome: 3,
      predictedAway: 1,
      actualHome: 3,
      actualAway: 1,
      stake: 100,
      oddsAtBet: null,
      oddsBoost: 1.0,
      lossPercentage: 90,
    });
    // even though the prediction is exact, oddsAtBet=null still counts as loss
    expect(r.basePayout).toBe(10);
    expect(r.result1x2Correct).toBe(false);
  });
});

describe("computePoolBase", () => {
  it("összegzi a tippelők lifetime budgetjét (init + tpm×meccsek + nettó)", () => {
    // 3 tippelő, init=200, tpm=100, matchesToDate=5 → 700 alap fejenként
    // nettók: [0, 300, -50] → 700*3 + 250 = 2350
    expect(
      computePoolBase({
        initialTokens: 200,
        tokenPerMatch: 100,
        matchesToDate: 5,
        bettorResolvedNets: [0, 300, -50],
      }),
    ).toBe(2350);
  });

  it("üres tippelő-lista → 0", () => {
    expect(
      computePoolBase({
        initialTokens: 200,
        tokenPerMatch: 100,
        matchesToDate: 5,
        bettorResolvedNets: [],
      }),
    ).toBe(0);
  });
});

describe("distributeBonusPools", () => {
  it("egyenlően oszt és lefelé kerekít; a két pool halmozható", () => {
    // poolBase=100000, gd 2% = 2000 / 3 = 666; ex 3% = 3000 / 2 = 1500
    const r = distributeBonusPools({
      poolBase: 100000,
      goalDiffHitters: 3,
      exactScoreHitters: 2,
      goalDiffPct: 2,
      exactScorePct: 3,
    });
    expect(r.goalDiffPerHitter).toBe(666);
    expect(r.exactScorePerHitter).toBe(1500);
  });

  it("0 találó → 0 bónusz az adott szinten", () => {
    const r = distributeBonusPools({
      poolBase: 100000,
      goalDiffHitters: 0,
      exactScoreHitters: 1,
      goalDiffPct: 2,
      exactScorePct: 3,
    });
    expect(r.goalDiffPerHitter).toBe(0);
    expect(r.exactScorePerHitter).toBe(3000);
  });

  it("negatív poolBase → 0 (guard)", () => {
    const r = distributeBonusPools({
      poolBase: -500,
      goalDiffHitters: 2,
      exactScoreHitters: 1,
      goalDiffPct: 2,
      exactScorePct: 3,
    });
    expect(r.goalDiffPerHitter).toBe(0);
    expect(r.exactScorePerHitter).toBe(0);
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
