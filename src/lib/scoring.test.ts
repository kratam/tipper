import { describe, expect, it } from "vitest";
import { calculateBaseBetPayout, computePoolBase, distributeBonusPools } from "@/lib/scoring";

describe("calculateBaseBetPayout", () => {
  it("void tipp (nincs odds) → partial refund, minden flag false", () => {
    const r = calculateBaseBetPayout({
      predictedHome: 2,
      predictedAway: 1,
      actualHome: 2,
      actualAway: 1,
      stake: 100,
      oddsAtBet: null,
      oddsBoost: 1.15,
      lossPercentage: 90,
    });
    expect(r).toEqual({
      basePayout: 10,
      result1x2Correct: false,
      goalDiffCorrect: false,
      exactScoreCorrect: false,
    });
  });

  it("1X2 rossz → partial refund, nincs flag", () => {
    const r = calculateBaseBetPayout({
      predictedHome: 2,
      predictedAway: 0,
      actualHome: 0,
      actualAway: 1,
      stake: 100,
      oddsAtBet: 2.0,
      oddsBoost: 1.0,
      lossPercentage: 90,
    });
    expect(r.basePayout).toBe(10);
    expect(r.result1x2Correct).toBe(false);
    expect(r.goalDiffCorrect).toBe(false);
    expect(r.exactScoreCorrect).toBe(false);
  });

  it("1X2 jó, gólkülönbség rossz → csak result1x2Correct", () => {
    const r = calculateBaseBetPayout({
      predictedHome: 1,
      predictedAway: 0,
      actualHome: 3,
      actualAway: 1,
      stake: 100,
      oddsAtBet: 2.0,
      oddsBoost: 1.15,
      lossPercentage: 90,
    });
    expect(r.basePayout).toBe(230); // round(100 * 2.0 * 1.15)
    expect(r.result1x2Correct).toBe(true);
    expect(r.goalDiffCorrect).toBe(false);
    expect(r.exactScoreCorrect).toBe(false);
  });

  it("gólkülönbség jó, de nem pontos → goalDiffCorrect true, exact false", () => {
    const r = calculateBaseBetPayout({
      predictedHome: 2,
      predictedAway: 1,
      actualHome: 3,
      actualAway: 2,
      stake: 100,
      oddsAtBet: 2.0,
      oddsBoost: 1.0,
      lossPercentage: 90,
    });
    expect(r.result1x2Correct).toBe(true);
    expect(r.goalDiffCorrect).toBe(true);
    expect(r.exactScoreCorrect).toBe(false);
  });

  it("pontos eredmény → mindkét flag true", () => {
    const r = calculateBaseBetPayout({
      predictedHome: 2,
      predictedAway: 1,
      actualHome: 2,
      actualAway: 1,
      stake: 100,
      oddsAtBet: 2.0,
      oddsBoost: 1.0,
      lossPercentage: 90,
    });
    expect(r.goalDiffCorrect).toBe(true);
    expect(r.exactScoreCorrect).toBe(true);
  });
});

describe("computePoolBase", () => {
  it("összegzi a tippelők lifetime budgetjét", () => {
    // 3 tippelő, init=200, tpm=100, matchesToDate=5 → 700 alap fejenként
    // nettók: [0, 300, -50] → 700*3 + 250 = 2350
    const base = computePoolBase({
      initialTokens: 200,
      tokenPerMatch: 100,
      matchesToDate: 5,
      bettorResolvedNets: [0, 300, -50],
    });
    expect(base).toBe(2350);
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
  it("egyenlően oszt és lefelé kerekít", () => {
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
