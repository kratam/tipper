import { describe, expect, it } from "vitest";
import {
  computeAbsoluteMatchBadges,
  computeExactStreak,
  computeJackpot,
  computeWinStreak,
  type ScoredBet,
} from "@/lib/badges/evaluate";

function bet(p: Partial<ScoredBet>): ScoredBet {
  return {
    matchId: "m",
    scheduledAt: new Date("2026-01-01"),
    result1x2Correct: false,
    exactScoreCorrect: false,
    oddsAtBet: null,
    stake: 100,
    ...p,
  };
}

describe("computeWinStreak", () => {
  it("returns longest uninterrupted 1X2-correct run", () => {
    const bets = [true, true, false, true, true, true, false].map((w) =>
      bet({ result1x2Correct: w }),
    );
    expect(computeWinStreak(bets)).toBe(3);
  });
  it("returns 0 for no wins", () => {
    expect(computeWinStreak([bet({}), bet({})])).toBe(0);
  });
});

describe("computeExactStreak", () => {
  it("counts only exact-score runs", () => {
    const bets = [true, true, false].map((e) => bet({ exactScoreCorrect: e }));
    expect(computeExactStreak(bets)).toBe(2);
  });
});

describe("computeJackpot", () => {
  it("counts winning bets at odds>=3 with stake>=minStake, tracks max odds", () => {
    const bets = [
      bet({ result1x2Correct: true, oddsAtBet: 4.0, stake: 100 }),
      bet({ result1x2Correct: true, oddsAtBet: 9.0, stake: 100 }),
      bet({ result1x2Correct: true, oddsAtBet: 5.0, stake: 50 }), // stake too low
      bet({ result1x2Correct: false, oddsAtBet: 10.0, stake: 100 }), // lost
      bet({ result1x2Correct: true, oddsAtBet: 2.5, stake: 100 }), // odds too low
    ];
    expect(computeJackpot(bets, 100)).toEqual({ count: 2, maxOdds: 9.0 });
  });
  it("returns zero when none qualify", () => {
    expect(
      computeJackpot([bet({ result1x2Correct: true, oddsAtBet: 2, stake: 100 })], 100),
    ).toEqual({ count: 0, maxOdds: 0 });
  });
});

describe("computeAbsoluteMatchBadges", () => {
  it("emits win_streak tier and jackpot with bestValue", () => {
    const bets = [
      bet({ result1x2Correct: true, oddsAtBet: 6.0, stake: 100 }),
      bet({ result1x2Correct: true }),
      bet({ result1x2Correct: true }),
    ];
    const out = computeAbsoluteMatchBadges(bets);
    // biome-ignore lint/style/noNonNullAssertion: test data known to exist
    const ws = out.find((b) => b.badgeKey === "win_streak")!;
    expect(ws.tier).toBe(1); // 3-run = bronze
    expect(ws.count).toBe(3);
    // biome-ignore lint/style/noNonNullAssertion: test data known to exist
    const jp = out.find((b) => b.badgeKey === "jackpot")!;
    expect(jp.tier).toBe(2); // 6.0 odds = silver
    expect(jp.count).toBe(1);
    expect(jp.bestValue).toBe(6.0);
  });
});
