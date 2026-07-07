import { describe, expect, it } from "vitest";
import {
  netProfit,
  shouldShowGroupBadge,
  sortBetRowsByScheduledDesc,
  sortTournamentSummaries,
} from "@/lib/profile-bets";

describe("netProfit", () => {
  it("returns payout minus stake for a resolved bet", () => {
    expect(netProfit(150, 100)).toBe(50);
  });

  it("returns a negative net for a losing resolved bet (payout already includes refund)", () => {
    expect(netProfit(30, 100)).toBe(-70);
  });

  it("treats a null payout as the full stake lost", () => {
    expect(netProfit(null, 40)).toBe(-40);
  });

  it("handles a zero payout", () => {
    expect(netProfit(0, 20)).toBe(-20);
  });
});

describe("shouldShowGroupBadge", () => {
  it("hides the badge when the tournament has a single official group", () => {
    expect(shouldShowGroupBadge(1)).toBe(false);
  });

  it("shows the badge when more than one official group is present", () => {
    expect(shouldShowGroupBadge(2)).toBe(true);
  });

  it("hides the badge for a zero count", () => {
    expect(shouldShowGroupBadge(0)).toBe(false);
  });
});

describe("sortBetRowsByScheduledDesc", () => {
  it("orders rows by scheduledAt descending", () => {
    const rows = [
      { matchId: "a", scheduledAt: "2026-01-01T10:00:00.000Z" },
      { matchId: "b", scheduledAt: "2026-03-01T10:00:00.000Z" },
      { matchId: "c", scheduledAt: "2026-02-01T10:00:00.000Z" },
    ];
    expect(sortBetRowsByScheduledDesc(rows).map((r) => r.matchId)).toEqual(["b", "c", "a"]);
  });

  it("does not mutate the input array", () => {
    const rows = [
      { matchId: "a", scheduledAt: "2026-01-01T10:00:00.000Z" },
      { matchId: "b", scheduledAt: "2026-02-01T10:00:00.000Z" },
    ];
    const snapshot = rows.map((r) => r.matchId);
    sortBetRowsByScheduledDesc(rows);
    expect(rows.map((r) => r.matchId)).toEqual(snapshot);
  });
});

describe("sortTournamentSummaries", () => {
  it("puts active tournaments before finished ones", () => {
    const list = [
      { tournamentId: "fin", status: "finished", lastMatchAt: "2026-05-01T00:00:00.000Z" },
      { tournamentId: "act", status: "active", lastMatchAt: "2026-01-01T00:00:00.000Z" },
    ];
    expect(sortTournamentSummaries(list).map((t) => t.tournamentId)).toEqual(["act", "fin"]);
  });

  it("orders same-status tournaments by lastMatchAt descending", () => {
    const list = [
      { tournamentId: "old", status: "finished", lastMatchAt: "2026-01-01T00:00:00.000Z" },
      { tournamentId: "new", status: "finished", lastMatchAt: "2026-06-01T00:00:00.000Z" },
    ];
    expect(sortTournamentSummaries(list).map((t) => t.tournamentId)).toEqual(["new", "old"]);
  });

  it("does not mutate the input array", () => {
    const list = [
      { tournamentId: "a", status: "finished", lastMatchAt: "2026-01-01T00:00:00.000Z" },
      { tournamentId: "b", status: "active", lastMatchAt: "2026-02-01T00:00:00.000Z" },
    ];
    const snapshot = list.map((t) => t.tournamentId);
    sortTournamentSummaries(list);
    expect(list.map((t) => t.tournamentId)).toEqual(snapshot);
  });
});
