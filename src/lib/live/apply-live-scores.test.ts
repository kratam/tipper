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
    expect(applyLiveScores(round, undefined, "u1", "g1")).toEqual(round);
  });

  it("a meccs score-ját és status-át frissíti a snapshotból", () => {
    const live: LiveMatchData[] = [
      { matchId: "m1", homeScore: 3, awayScore: 2, status: "finished", userBets: [] },
    ];
    const out = applyLiveScores(round, live, "u1", "g1");
    expect(out.matches[0].homeScore).toBe(3);
    expect(out.matches[0].awayScore).toBe(2);
    expect(out.matches[0].status).toBe("finished");
  });

  it("a tippek payout/helyesség mezőit a (userId, groupId, matchId) egyezés alapján frissíti", () => {
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
            groupId: "g1",
            result1x2Correct: true,
            goalDiffCorrect: true,
            exactScoreCorrect: true,
            payout: 99,
          },
        ],
      },
    ];
    const out = applyLiveScores(round, live, "u1", "g1");
    expect(out.bets[0].payout).toBe(99);
    expect(out.bets[0].exactScoreCorrect).toBe(true);
  });

  it("CSAK a néző saját sorát frissíti — más játékos (u2) tippje változatlan", () => {
    // Multi-user round: u1 (néző) ÉS u2 is tippelt UGYANARRA a befejezett
    // meccsre. A snapshot CSAK u1 élő tippjét hordozza. u1 sora kapja az élő
    // payout-ot, u2 sora ÉRINTETLEN marad.
    const multiUserRound: TipMatrixRound = {
      ...round,
      bets: [
        round.bets[0], // u1, payout: null
        {
          matchId: "m1",
          userId: "u2",
          predictedHome: 0,
          predictedAway: 3,
          stake: 10,
          oddsAtBet: "1.5",
          payout: 42,
          result1x2Correct: false,
          goalDiffCorrect: false,
          exactScoreCorrect: false,
        },
      ],
    };
    const live: LiveMatchData[] = [
      {
        matchId: "m1",
        homeScore: 2,
        awayScore: 1,
        status: "finished",
        userBets: [
          {
            betId: "u1-bet",
            matchId: "m1",
            groupId: "g1",
            result1x2Correct: true,
            goalDiffCorrect: true,
            exactScoreCorrect: true,
            payout: 99,
          },
        ],
      },
    ];
    const out = applyLiveScores(multiUserRound, live, "u1", "g1");

    const u1Row = out.bets.find((b) => b.userId === "u1");
    const u2Row = out.bets.find((b) => b.userId === "u2");

    // u1 (néző) kapja az élő értékeket
    expect(u1Row?.payout).toBe(99);
    expect(u1Row?.result1x2Correct).toBe(true);
    expect(u1Row?.goalDiffCorrect).toBe(true);
    expect(u1Row?.exactScoreCorrect).toBe(true);

    // u2 sora VÁLTOZATLAN (nem a néző payout-jával felülírva)
    expect(u2Row?.payout).toBe(42);
    expect(u2Row?.result1x2Correct).toBe(false);
    expect(u2Row?.goalDiffCorrect).toBe(false);
    expect(u2Row?.exactScoreCorrect).toBe(false);
  });

  it("multi-group: a néző (u1) UGYANARRA a meccsre két csoportban tippelt — a g1 mátrix a g1 payout-ot kapja, nem a g2-ét", () => {
    // A néző u1 ugyanarra a befejezett m1 meccsre tippelt g1-ben ÉS g2-ben,
    // ELTÉRŐ payouttal (oddsBoost/stake/bónusz miatt). A snapshot userBets-e
    // NEM csoport-szűrt, és a g2 tipp van ELŐL a listában → a régi liveBets[0]
    // a ROSSZ (g2) csoport payout-ját írná a g1 mátrix cellájába. A groupId-
    // szűréssel a g1 mátrix a g1 payout-ot kapja.
    const live: LiveMatchData[] = [
      {
        matchId: "m1",
        homeScore: 2,
        awayScore: 1,
        status: "finished",
        userBets: [
          {
            // g2 SZÁNDÉKOSAN előrébb — liveBets[0] ezt választaná (RED)
            betId: "u1-g2-bet",
            matchId: "m1",
            groupId: "g2",
            result1x2Correct: false,
            goalDiffCorrect: false,
            exactScoreCorrect: false,
            payout: 7,
          },
          {
            betId: "u1-g1-bet",
            matchId: "m1",
            groupId: "g1",
            result1x2Correct: true,
            goalDiffCorrect: true,
            exactScoreCorrect: true,
            payout: 99,
          },
        ],
      },
    ];
    // A round a g1 mátrix (round.bets a g1-re szűrt — u1, payout: null)
    const out = applyLiveScores(round, live, "u1", "g1");
    const u1Row = out.bets.find((b) => b.userId === "u1");

    // A g1 payout-ot kapja (99), NEM a g2-ét (7)
    expect(u1Row?.payout).toBe(99);
    expect(u1Row?.result1x2Correct).toBe(true);
    expect(u1Row?.goalDiffCorrect).toBe(true);
    expect(u1Row?.exactScoreCorrect).toBe(true);
  });
});
