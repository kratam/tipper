import { describe, expect, it } from "vitest";
import {
  betNet,
  filterRoundBetsForViewer,
  groupMatchesIntoRounds,
  isMatchLocked,
  pickDefaultRoundKey,
  type RoundMatchInput,
} from "@/lib/tip-matrix";

const d = (iso: string) => new Date(iso);

const matches: RoundMatchInput[] = [
  { id: "m3", round: "2. forduló", scheduledAt: d("2026-06-20T18:00:00Z"), status: "scheduled" },
  { id: "m1", round: "1. forduló", scheduledAt: d("2026-06-18T18:00:00Z"), status: "finished" },
  { id: "m2", round: "1. forduló", scheduledAt: d("2026-06-18T20:00:00Z"), status: "finished" },
  { id: "m4", round: "2. forduló", scheduledAt: d("2026-06-20T20:00:00Z"), status: "scheduled" },
];

describe("groupMatchesIntoRounds", () => {
  it("groups by round and orders rounds by earliest match", () => {
    const rounds = groupMatchesIntoRounds(matches);
    expect(rounds.map((r) => r.key)).toEqual(["1. forduló", "2. forduló"]);
  });

  it("orders matchIds within a round by scheduledAt", () => {
    const rounds = groupMatchesIntoRounds(matches);
    expect(rounds[0].matchIds).toEqual(["m1", "m2"]);
    expect(rounds[1].matchIds).toEqual(["m3", "m4"]);
  });

  it("returns [] for no matches", () => {
    expect(groupMatchesIntoRounds([])).toEqual([]);
  });
});

describe("pickDefaultRoundKey", () => {
  it("picks the latest round that has a started match", () => {
    const rounds = groupMatchesIntoRounds(matches);
    // only round 1 matches have started
    const started = new Set(["m1", "m2"]);
    expect(pickDefaultRoundKey(rounds, started)).toBe("1. forduló");
  });

  it("picks the latest round when a later round has started", () => {
    const rounds = groupMatchesIntoRounds(matches);
    const started = new Set(["m1", "m2", "m3"]);
    expect(pickDefaultRoundKey(rounds, started)).toBe("2. forduló");
  });

  it("falls back to the earliest round when nothing has started", () => {
    const rounds = groupMatchesIntoRounds(matches);
    expect(pickDefaultRoundKey(rounds, new Set())).toBe("1. forduló");
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
  it("finished => locked even if scheduledAt somehow future", () => {
    expect(isMatchLocked("finished", d("2026-06-20T20:00:00Z"), now)).toBe(true);
  });
  it("cancelled => locked", () => {
    expect(isMatchLocked("cancelled", d("2026-06-20T20:00:00Z"), now)).toBe(true);
  });
  it("live status => locked even if scheduledAt is future", () => {
    expect(isMatchLocked("live", d("2026-06-20T20:00:00Z"), now)).toBe(true);
  });
});

describe("filterRoundBetsForViewer", () => {
  const bets = [
    { matchId: "locked1", userId: "u1" },
    { matchId: "locked1", userId: "u2" },
    { matchId: "future1", userId: "u1" }, // me
    { matchId: "future1", userId: "u2" }, // someone else — MUST be hidden
  ];
  const locked = new Set(["locked1"]);

  it("keeps all bets on locked matches", () => {
    const visible = filterRoundBetsForViewer(bets, locked, "u1");
    expect(visible.filter((b) => b.matchId === "locked1")).toHaveLength(2);
  });

  it("hides other users' bets on not-yet-locked matches", () => {
    const visible = filterRoundBetsForViewer(bets, locked, "u1");
    const future = visible.filter((b) => b.matchId === "future1");
    expect(future).toHaveLength(1);
    expect(future[0].userId).toBe("u1");
  });

  it("keeps the viewer's own bet on a future match", () => {
    const visible = filterRoundBetsForViewer(bets, locked, "u2");
    const future = visible.filter((b) => b.matchId === "future1");
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
