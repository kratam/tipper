import { describe, expect, it } from "vitest";
import {
  betNet,
  deriveRounds,
  filterRoundBetsForViewer,
  isMatchLocked,
  knockoutBucketSizes,
  pickDefaultRoundKey,
  type RoundGroup,
  type RoundMatchInput,
} from "@/lib/tip-matrix";

const d = (iso: string) => new Date(iso);
const mk = (
  id: string,
  iso: string,
  home: string,
  away: string,
  participantsKnown = true,
): RoundMatchInput => ({
  id,
  scheduledAt: d(iso),
  homeTeamId: home,
  awayTeamId: away,
  participantsKnown,
});

describe("knockoutBucketSizes", () => {
  it("32 matches (R32..Final+3rd) => [16,8,4,2,2]", () => {
    expect(knockoutBucketSizes(32)).toEqual([16, 8, 4, 2, 2]);
  });
  it("31 matches (no 3rd place) => [16,8,4,2,1]", () => {
    expect(knockoutBucketSizes(31)).toEqual([16, 8, 4, 2, 1]);
  });
  it("16 matches (from 16 teams + 3rd) => [8,4,2,2]", () => {
    expect(knockoutBucketSizes(16)).toEqual([8, 4, 2, 2]);
  });
  it("3 matches (SF + Final) => [2,1]", () => {
    expect(knockoutBucketSizes(3)).toEqual([2, 1]);
  });
  it("2 and 1 collapse to a single final round", () => {
    expect(knockoutBucketSizes(2)).toEqual([2]);
    expect(knockoutBucketSizes(1)).toEqual([1]);
  });
  it("0 => []", () => {
    expect(knockoutBucketSizes(0)).toEqual([]);
  });
});

describe("deriveRounds", () => {
  it("returns [] for no matches", () => {
    expect(deriveRounds([])).toEqual([]);
  });

  it("pure round-robin: every team once per round, numbered group rounds, no knockout", () => {
    const matches = [
      mk("m1", "2026-06-11T18:00:00Z", "A", "B"),
      mk("m2", "2026-06-11T20:00:00Z", "C", "D"),
      mk("m3", "2026-06-13T18:00:00Z", "A", "C"),
      mk("m4", "2026-06-13T20:00:00Z", "B", "D"),
    ];
    const rounds = deriveRounds(matches);
    expect(rounds.map((r) => r.key)).toEqual(["g1", "g2"]);
    expect(rounds.every((r) => r.kind === "group")).toBe(true);
    expect(rounds[0].groupNumber).toBe(1);
    expect(rounds[0].matchIds).toEqual(["m1", "m2"]);
    expect(rounds[1].groupNumber).toBe(2);
    expect(rounds[1].matchIds).toEqual(["m3", "m4"]);
  });

  it("group stage spans/overlaps dates but stays one round per team-appearance", () => {
    const matches = [
      mk("a", "2026-06-11T18:00:00Z", "A", "B"), // A1,B1 -> r1
      mk("b", "2026-06-12T18:00:00Z", "C", "D"), // C1,D1 -> r1
      mk("c", "2026-06-14T18:00:00Z", "A", "C"), // A2,C2 -> r2
      mk("e", "2026-06-15T18:00:00Z", "B", "D"), // B2,D2 -> r2
    ];
    const rounds = deriveRounds(matches);
    expect(rounds.map((r) => r.matchIds)).toEqual([
      ["a", "b"],
      ["c", "e"],
    ]);
  });

  it("group + knockout placeholders: numbered group rounds then named stages", () => {
    const matches = [
      mk("g1a", "2026-06-11T18:00:00Z", "A", "B"),
      mk("g1b", "2026-06-11T20:00:00Z", "C", "D"),
      mk("g2a", "2026-06-13T18:00:00Z", "A", "D"),
      mk("g2b", "2026-06-13T20:00:00Z", "B", "C"),
      mk("sf1", "2026-06-16T18:00:00Z", "1A", "2B", false),
      mk("sf2", "2026-06-16T20:00:00Z", "1B", "2A", false),
      mk("fin", "2026-06-18T18:00:00Z", "W1", "W2", false),
    ];
    const rounds = deriveRounds(matches);
    expect(rounds.map((r) => r.key)).toEqual(["g1", "g2", "k1", "k2"]);
    expect(rounds[2]).toMatchObject({ kind: "knockout", knockoutTeams: 4, isFinal: false });
    expect(rounds[2].matchIds).toEqual(["sf1", "sf2"]);
    expect(rounds[3]).toMatchObject({ kind: "knockout", knockoutTeams: 2, isFinal: true });
    expect(rounds[3].matchIds).toEqual(["fin"]);
  });

  it("played knockout (real teams beyond group) joins the knockout bucket, not a new group round", () => {
    const matches = [
      mk("g1a", "2026-06-11T18:00:00Z", "A", "B"),
      mk("g1b", "2026-06-11T20:00:00Z", "C", "D"),
      mk("g2a", "2026-06-13T18:00:00Z", "A", "D"),
      mk("g2b", "2026-06-13T20:00:00Z", "B", "C"),
      mk("ko", "2026-06-16T18:00:00Z", "A", "C"),
      mk("fin", "2026-06-18T18:00:00Z", "W1", "W2", false),
    ];
    const rounds = deriveRounds(matches);
    expect(rounds.map((r) => r.key)).toEqual(["g1", "g2", "k1"]);
    const ko = rounds[2];
    expect(ko.kind).toBe("knockout");
    expect(ko.isFinal).toBe(true);
    expect(ko.matchIds).toEqual(["ko", "fin"]);
  });
});

describe("pickDefaultRoundKey", () => {
  const rounds: RoundGroup[] = [
    {
      key: "g1",
      kind: "group",
      groupNumber: 1,
      knockoutTeams: null,
      isFinal: false,
      matchIds: ["m1", "m2"],
      minScheduledAt: 1,
    },
    {
      key: "g2",
      kind: "group",
      groupNumber: 2,
      knockoutTeams: null,
      isFinal: false,
      matchIds: ["m3", "m4"],
      minScheduledAt: 2,
    },
    {
      key: "k1",
      kind: "knockout",
      groupNumber: null,
      knockoutTeams: 4,
      isFinal: true,
      matchIds: ["m5"],
      minScheduledAt: 3,
    },
  ];

  it("picks the latest round that has a started match", () => {
    expect(pickDefaultRoundKey(rounds, new Set(["m1", "m2", "m3"]))).toBe("g2");
  });
  it("picks the latest round even if a later round started", () => {
    expect(pickDefaultRoundKey(rounds, new Set(["m1", "m5"]))).toBe("k1");
  });
  it("falls back to the earliest round when nothing has started", () => {
    expect(pickDefaultRoundKey(rounds, new Set())).toBe("g1");
  });
  it("returns null when there are no rounds", () => {
    expect(pickDefaultRoundKey([], new Set())).toBeNull();
  });
});

describe("isMatchLocked", () => {
  const now = d("2026-06-20T19:00:00Z");
  it("scheduled & future => not locked", () => {
    expect(isMatchLocked("scheduled", d("2026-06-20T20:00:00Z"), now)).toBe(false);
  });
  it("scheduled but kickoff passed => locked", () => {
    expect(isMatchLocked("scheduled", d("2026-06-20T18:00:00Z"), now)).toBe(true);
  });
  it("live status => locked even if scheduledAt is future", () => {
    expect(isMatchLocked("live", d("2026-06-20T20:00:00Z"), now)).toBe(true);
  });
  it("finished => locked", () => {
    expect(isMatchLocked("finished", d("2026-06-20T20:00:00Z"), now)).toBe(true);
  });
  it("cancelled => locked", () => {
    expect(isMatchLocked("cancelled", d("2026-06-20T20:00:00Z"), now)).toBe(true);
  });
});

describe("filterRoundBetsForViewer", () => {
  const bets = [
    { matchId: "locked1", userId: "u1" },
    { matchId: "locked1", userId: "u2" },
    { matchId: "future1", userId: "u1" },
    { matchId: "future1", userId: "u2" },
  ];
  const locked = new Set(["locked1"]);

  it("keeps all bets on locked matches", () => {
    expect(
      filterRoundBetsForViewer(bets, locked, "u1").filter((b) => b.matchId === "locked1"),
    ).toHaveLength(2);
  });
  it("hides other users' bets on not-yet-locked matches", () => {
    const future = filterRoundBetsForViewer(bets, locked, "u1").filter(
      (b) => b.matchId === "future1",
    );
    expect(future).toHaveLength(1);
    expect(future[0].userId).toBe("u1");
  });
  it("keeps the viewer's own bet on a future match", () => {
    const future = filterRoundBetsForViewer(bets, locked, "u2").filter(
      (b) => b.matchId === "future1",
    );
    expect(future).toHaveLength(1);
    expect(future[0].userId).toBe("u2");
  });
});

describe("betNet", () => {
  it("returns payout - stake when scored", () => {
    expect(betNet(280, 100)).toBe(180);
  });
  it("returns negative net for a loss", () => {
    expect(betNet(10, 100)).toBe(-90);
  });
  it("returns null when payout is null (not scored)", () => {
    expect(betNet(null, 100)).toBeNull();
  });
});
