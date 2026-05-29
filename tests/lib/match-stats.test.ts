import { describe, expect, it } from "vitest";
import {
  classify1x2,
  computeMatchStats,
  pickTipsView,
  rankBets,
  type StatBet,
  sortLiveBets,
} from "@/lib/match-stats";

function makeBet(overrides: Partial<StatBet> & { betId: string }): StatBet {
  return {
    userId: overrides.betId,
    predictedHome: 1,
    predictedAway: 0,
    stake: 100,
    result1x2Correct: null,
    payout: null,
    ...overrides,
  };
}

describe("classify1x2", () => {
  it("returns 1 for a home win prediction", () => {
    expect(classify1x2(3, 1)).toBe("1");
  });
  it("returns X for a draw prediction", () => {
    expect(classify1x2(2, 2)).toBe("X");
  });
  it("returns 2 for an away win prediction", () => {
    expect(classify1x2(0, 1)).toBe("2");
  });
});

describe("rankBets", () => {
  it("ranks by profit (payout - stake) descending with sequential ranks", () => {
    const bets = [
      makeBet({ betId: "a", stake: 100, payout: 150 }), // +50
      makeBet({ betId: "b", stake: 200, payout: 600 }), // +400
      makeBet({ betId: "c", stake: 100, payout: 0 }), // -100
    ];
    const ranked = rankBets(bets, "profit");
    expect(ranked.map((r) => r.betId)).toEqual(["b", "a", "c"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(ranked.map((r) => r.profit)).toEqual([400, 50, -100]);
  });

  it("treats null payout as zero payout (full loss) for profit", () => {
    const ranked = rankBets([makeBet({ betId: "a", stake: 100, payout: null })], "profit");
    expect(ranked[0].profit).toBe(-100);
  });

  it("ranks by stake descending in stake mode", () => {
    const bets = [
      makeBet({ betId: "a", stake: 100 }),
      makeBet({ betId: "b", stake: 500 }),
      makeBet({ betId: "c", stake: 250 }),
    ];
    const ranked = rankBets(bets, "stake");
    expect(ranked.map((r) => r.betId)).toEqual(["b", "c", "a"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("breaks equal profit by higher stake, then betId, for a stable order", () => {
    const bets = [
      makeBet({ betId: "c", stake: 100, payout: 200 }), // +100
      makeBet({ betId: "a", stake: 300, payout: 400 }), // +100, bigger stake → first
      makeBet({ betId: "b", stake: 100, payout: 200 }), // +100, ties with c → betId order
    ];
    expect(rankBets(bets, "profit").map((r) => r.betId)).toEqual(["a", "b", "c"]);
  });
});

describe("pickTipsView", () => {
  // 10 bets, profit descending: rank N has profit (11 - N) * 10
  const ranked = rankBets(
    Array.from({ length: 10 }, (_, i) =>
      makeBet({ betId: `u${i + 1}`, stake: 100, payout: 100 + (10 - i) * 10 }),
    ),
    "profit",
  );

  it("shows only the podium when the user is in the top 3", () => {
    const view = pickTipsView(ranked, "u2");
    expect(view.podium.map((r) => r.betId)).toEqual(["u1", "u2", "u3"]);
    expect(view.neighbors).toEqual([]);
    expect(view.hiddenBetween).toBe(0);
    expect(view.currentUserRank).toBe(2);
  });

  it("shows podium + a ±2 window around the user with a gap marker", () => {
    const view = pickTipsView(ranked, "u7"); // rank 7
    expect(view.podium.map((r) => r.betId)).toEqual(["u1", "u2", "u3"]);
    expect(view.neighbors.map((r) => r.betId)).toEqual(["u5", "u6", "u7", "u8", "u9"]);
    expect(view.hiddenBetween).toBe(1); // rank 4 hidden between podium and window
    expect(view.currentUserRank).toBe(7);
  });

  it("merges the window with the podium when they are adjacent (no gap)", () => {
    const view = pickTipsView(ranked, "u4"); // rank 4
    expect(view.neighbors.map((r) => r.betId)).toEqual(["u4", "u5", "u6"]);
    expect(view.hiddenBetween).toBe(0);
  });

  it("clamps the window at the end of the list for the last-ranked user", () => {
    const view = pickTipsView(ranked, "u10"); // rank 10 (last)
    expect(view.neighbors.map((r) => r.betId)).toEqual(["u8", "u9", "u10"]);
    expect(view.currentUserRank).toBe(10);
  });

  it("falls back to the podium when the user has no bet", () => {
    const view = pickTipsView(ranked, "stranger");
    expect(view.podium.map((r) => r.betId)).toEqual(["u1", "u2", "u3"]);
    expect(view.neighbors).toEqual([]);
    expect(view.currentUserRank).toBeNull();
  });

  it("returns all rows as podium when there are fewer than 3 bets", () => {
    const small = rankBets(
      [makeBet({ betId: "a", payout: 200 }), makeBet({ betId: "b", payout: 150 })],
      "profit",
    );
    const view = pickTipsView(small, "b");
    expect(view.podium.map((r) => r.betId)).toEqual(["a", "b"]);
    expect(view.neighbors).toEqual([]);
    expect(view.total).toBe(2);
  });
});

describe("sortLiveBets", () => {
  it("pins the current user first, then orders the rest by stake descending", () => {
    const bets = [
      makeBet({ betId: "a", stake: 100 }),
      makeBet({ betId: "me", stake: 50 }),
      makeBet({ betId: "b", stake: 500 }),
    ];
    const sorted = sortLiveBets(bets, "me");
    expect(sorted.map((b) => b.betId)).toEqual(["me", "b", "a"]);
  });

  it("orders purely by stake when the current user has no bet", () => {
    const bets = [makeBet({ betId: "a", stake: 100 }), makeBet({ betId: "b", stake: 500 })];
    expect(sortLiveBets(bets, "me").map((b) => b.betId)).toEqual(["b", "a"]);
  });
});

describe("computeMatchStats", () => {
  const finishedCtx = { homeScore: 5, awayScore: 1, isFinished: true };

  it("computes the 1-X-2 distribution by stake share", () => {
    const bets = [
      makeBet({ betId: "a", predictedHome: 3, predictedAway: 1, stake: 600 }), // 1
      makeBet({ betId: "b", predictedHome: 2, predictedAway: 2, stake: 200 }), // X
      makeBet({ betId: "c", predictedHome: 0, predictedAway: 1, stake: 200 }), // 2
    ];
    const stats = computeMatchStats(bets, finishedCtx);
    const byKey = Object.fromEntries(stats.distribution.map((d) => [d.key, d]));
    expect(byKey["1"].count).toBe(1);
    expect(byKey["1"].totalStake).toBe(600);
    expect(byKey["1"].pct).toBe(60);
    expect(byKey.X.pct).toBe(20);
    expect(byKey["2"].pct).toBe(20);
    expect(stats.distribution.map((d) => d.key)).toEqual(["1", "X", "2"]);
  });

  it("falls back to count share when nobody staked tokens", () => {
    const bets = [
      makeBet({ betId: "a", predictedHome: 1, predictedAway: 0, stake: 0 }),
      makeBet({ betId: "b", predictedHome: 0, predictedAway: 1, stake: 0 }),
    ];
    const byKey = Object.fromEntries(
      computeMatchStats(bets, finishedCtx).distribution.map((d) => [d.key, d]),
    );
    expect(byKey["1"].pct).toBe(50);
    expect(byKey["2"].pct).toBe(50);
  });

  it("computes total, average, and biggest stake", () => {
    const bets = [
      makeBet({ betId: "a", stake: 100 }),
      makeBet({ betId: "b", stake: 300 }),
      makeBet({ betId: "c", stake: 200 }),
    ];
    const stats = computeMatchStats(bets, finishedCtx);
    expect(stats.totalStake).toBe(600);
    expect(stats.avgStake).toBe(200);
    expect(stats.biggestStakeBetId).toBe("b");
  });

  it("finds the most common tip and breaks ties by total stake", () => {
    const bets = [
      makeBet({ betId: "a", predictedHome: 4, predictedAway: 1, stake: 100 }),
      makeBet({ betId: "b", predictedHome: 4, predictedAway: 1, stake: 100 }),
      makeBet({ betId: "c", predictedHome: 2, predictedAway: 0, stake: 100 }),
      makeBet({ betId: "d", predictedHome: 2, predictedAway: 0, stake: 5000 }),
    ];
    // 4-1 and 2-0 both appear twice; 2-0 wins on total stake
    const stats = computeMatchStats(bets, finishedCtx);
    expect(stats.mostCommonTip).toEqual({ home: 2, away: 0, count: 2 });
  });

  it("computes the average tip rounded to one decimal", () => {
    const bets = [
      makeBet({ betId: "a", predictedHome: 4, predictedAway: 1 }),
      makeBet({ betId: "b", predictedHome: 5, predictedAway: 2 }),
      makeBet({ betId: "c", predictedHome: 3, predictedAway: 1 }),
    ];
    const stats = computeMatchStats(bets, finishedCtx);
    expect(stats.avgTip).toEqual({ home: 4, away: 1.3 });
  });

  it("counts exact-score and winner hits for finished matches", () => {
    const bets = [
      makeBet({ betId: "a", predictedHome: 5, predictedAway: 1, result1x2Correct: true }), // exact + winner
      makeBet({ betId: "b", predictedHome: 3, predictedAway: 0, result1x2Correct: true }), // winner only
      makeBet({ betId: "c", predictedHome: 0, predictedAway: 2, result1x2Correct: false }),
    ];
    const stats = computeMatchStats(bets, finishedCtx);
    expect(stats.exactCorrectCount).toBe(1);
    expect(stats.winnerCorrectCount).toBe(2);
  });

  it("omits finished-only counts for a live match", () => {
    const bets = [makeBet({ betId: "a", predictedHome: 2, predictedAway: 0, stake: 100 })];
    const stats = computeMatchStats(bets, { homeScore: 1, awayScore: 0, isFinished: false });
    expect(stats.exactCorrectCount).toBeNull();
    expect(stats.winnerCorrectCount).toBeNull();
    expect(stats.betCount).toBe(1);
  });

  it("returns safe zero values for an empty bet list", () => {
    const stats = computeMatchStats([], finishedCtx);
    expect(stats.betCount).toBe(0);
    expect(stats.totalStake).toBe(0);
    expect(stats.avgStake).toBe(0);
    expect(stats.biggestStakeBetId).toBeNull();
    expect(stats.mostCommonTip).toBeNull();
    expect(stats.avgTip).toBeNull();
    expect(stats.distribution.map((d) => d.pct)).toEqual([0, 0, 0]);
  });
});
