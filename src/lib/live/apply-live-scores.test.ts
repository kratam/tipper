import { describe, expect, it } from "vitest";
import type { LiveMatchData } from "@/actions/live";
import type { TipMatrixRound } from "@/queries/tip-matrix";
import { applyLiveScores } from "./apply-live-scores";

const round: TipMatrixRound = {
  roundKey: "r1",
  roundKind: "group",
  roundGroupNumber: 1,
  roundKnockoutTeams: null,
  roundIsFinal: false,
  orderedRoundKeys: ["r1"],
  matches: [
    {
      id: "m1",
      homeTeam: { name: "A", logoUrl: null },
      awayTeam: { name: "B", logoUrl: null },
      homeScore: null,
      awayScore: null,
      status: "scheduled",
      scheduledAt: "2026-06-29T18:00:00.000Z",
      locked: false,
      odds: null,
    },
  ],
  bets: [
    {
      matchId: "m1",
      userId: "u1",
      predictedHome: 2,
      predictedAway: 1,
      stake: 10,
      oddsAtBet: "2.0",
      payout: null,
      result1x2Correct: null,
      goalDiffCorrect: null,
      exactScoreCorrect: null,
    },
  ],
};

describe("applyLiveScores", () => {
  it("liveData hiányában változatlan round-ot ad (másolatban)", () => {
    expect(applyLiveScores(round, undefined)).toEqual(round);
  });

  it("a meccs score-ját és status-át frissíti a snapshotból", () => {
    const live: LiveMatchData[] = [
      { matchId: "m1", homeScore: 3, awayScore: 2, status: "finished", userBets: [] },
    ];
    const out = applyLiveScores(round, live);
    expect(out.matches[0].homeScore).toBe(3);
    expect(out.matches[0].awayScore).toBe(2);
    expect(out.matches[0].status).toBe("finished");
  });

  it("a tippek payout/helyesség mezőit a (userId, matchId) egyezés alapján frissíti", () => {
    const live: LiveMatchData[] = [
      {
        matchId: "m1",
        homeScore: 2,
        awayScore: 1,
        status: "finished",
        userBets: [
          {
            betId: "ignored",
            matchId: "m1",
            result1x2Correct: true,
            goalDiffCorrect: true,
            exactScoreCorrect: true,
            payout: 99,
          },
        ],
      },
    ];
    const out = applyLiveScores(round, live);
    expect(out.bets[0].payout).toBe(99);
    expect(out.bets[0].exactScoreCorrect).toBe(true);
  });
});
