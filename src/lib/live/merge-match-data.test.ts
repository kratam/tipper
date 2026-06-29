import { describe, expect, it } from "vitest";
import type { LiveMatchData } from "@/actions/live";
import type { MatchCardData } from "@/components/match-card";
import { mergeMatchData } from "./merge-match-data";

const baseMatch: MatchCardData = {
  id: "m1",
  homeTeam: { name: "A", logoUrl: null },
  awayTeam: { name: "B", logoUrl: null },
  homeScore: null,
  awayScore: null,
  status: "scheduled",
  scheduledAt: "2026-06-29T18:00:00.000Z",
  round: "2026-06-29",
  odds: null,
  participantsKnown: true,
  userBets: [
    {
      id: "b1",
      predictedHome: 2,
      predictedAway: 1,
      stake: 10,
      result1x2Correct: null,
      goalDiffCorrect: null,
      exactScoreCorrect: null,
      payout: null,
      groupName: "G",
    },
  ],
};

describe("mergeMatchData", () => {
  it("liveData hiányában a meccseket változatlanul (másolatban) adja vissza", () => {
    const out = mergeMatchData([baseMatch], undefined);
    expect(out).toEqual([baseMatch]);
  });

  it("a friss score-t és status-t beolvasztja", () => {
    const live: LiveMatchData[] = [
      { matchId: "m1", homeScore: 3, awayScore: 1, status: "finished", userBets: [] },
    ];
    const out = mergeMatchData([baseMatch], live);
    expect(out[0].homeScore).toBe(3);
    expect(out[0].awayScore).toBe(1);
    expect(out[0].status).toBe("finished");
  });

  it("a tipp payout/helyesség mezőit a betId egyezés alapján frissíti", () => {
    const live: LiveMatchData[] = [
      {
        matchId: "m1",
        homeScore: 2,
        awayScore: 1,
        status: "finished",
        userBets: [
          {
            betId: "b1",
            matchId: "m1",
            result1x2Correct: true,
            goalDiffCorrect: true,
            exactScoreCorrect: true,
            payout: 42,
          },
        ],
      },
    ];
    const out = mergeMatchData([baseMatch], live);
    expect(out[0].userBets[0].payout).toBe(42);
    expect(out[0].userBets[0].result1x2Correct).toBe(true);
  });

  it("nem érintett meccset érintetlenül hagy", () => {
    const live: LiveMatchData[] = [
      { matchId: "other", homeScore: 1, awayScore: 0, status: "finished", userBets: [] },
    ];
    const out = mergeMatchData([baseMatch], live);
    expect(out[0]).toEqual(baseMatch);
  });
});
