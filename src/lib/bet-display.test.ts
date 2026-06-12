import { describe, expect, it } from "vitest";
import { type BetOutcome, deriveBetBonus, predictionToneClass } from "./bet-display";

function makeBet(overrides: Partial<BetOutcome> = {}): BetOutcome {
  return {
    result1x2Correct: true,
    goalDiffCorrect: false,
    exactScoreCorrect: false,
    payout: null,
    stake: 100,
    oddsAtBet: "1.63",
    ...overrides,
  };
}

describe("predictionToneClass", () => {
  it("telitalálat → félkövér zöld", () => {
    expect(predictionToneClass(makeBet({ goalDiffCorrect: true, exactScoreCorrect: true }))).toBe(
      "font-bold text-win",
    );
  });

  it("gólkülönbség → semibold zöld", () => {
    expect(predictionToneClass(makeBet({ goalDiffCorrect: true }))).toBe("font-semibold text-win");
  });

  it("csak 1X2 → halvány zöld", () => {
    expect(predictionToneClass(makeBet())).toBe("font-medium text-win/70");
  });

  it("rossz tipp → halvány piros", () => {
    expect(predictionToneClass(makeBet({ result1x2Correct: false }))).toBe(
      "font-medium text-loss/70",
    );
  });
});

describe("deriveBetBonus", () => {
  // payout = round(stake × oddsAtBet × oddsBoost) + bónuszok (lásd lib/scoring.ts)
  it("telitalálat: payout-ból visszaszámolja a bónuszt", () => {
    // round(300 × 1.63 × 1.1) = 538, payout 588 → bónusz 50
    const bet = makeBet({
      goalDiffCorrect: true,
      exactScoreCorrect: true,
      stake: 300,
      payout: 588,
    });
    expect(deriveBetBonus(bet, 1.1)).toBe(50);
  });

  it("gólkülönbség bónusz", () => {
    // round(100 × 1.63 × 1.1) = 179, payout 204 → bónusz 25
    const bet = makeBet({ goalDiffCorrect: true, stake: 100, payout: 204 });
    expect(deriveBetBonus(bet, 1.1)).toBe(25);
  });

  it("nincs gólkülönbség-találat → 0", () => {
    expect(deriveBetBonus(makeBet({ payout: 179 }), 1.1)).toBe(0);
  });

  it("nincs payout (még nem zárult le) → 0", () => {
    expect(deriveBetBonus(makeBet({ goalDiffCorrect: true }), 1.1)).toBe(0);
  });

  it("nincs rögzített odds → 0", () => {
    const bet = makeBet({ goalDiffCorrect: true, payout: 204, oddsAtBet: null });
    expect(deriveBetBonus(bet, 1.1)).toBe(0);
  });

  it("0 bónusz-beállítás esetén 0 (nem negatív)", () => {
    const bet = makeBet({ goalDiffCorrect: true, stake: 100, payout: 179 });
    expect(deriveBetBonus(bet, 1.1)).toBe(0);
  });
});
