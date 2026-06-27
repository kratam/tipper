import { describe, expect, it } from "vitest";
import { currentLeader, roundWinners, tournamentPlacements } from "@/lib/badges/relative";

describe("roundWinners", () => {
  it("returns the single top earner", () => {
    expect(
      roundWinners([
        { userId: "a", net: 50 },
        { userId: "b", net: 120 },
        { userId: "c", net: 30 },
      ]),
    ).toEqual(["b"]);
  });
  it("returns all tied top earners", () => {
    expect(
      roundWinners([
        { userId: "a", net: 120 },
        { userId: "b", net: 120 },
      ]),
    ).toEqual(["a", "b"]);
  });
  it("returns empty when all non-positive", () => {
    expect(
      roundWinners([
        { userId: "a", net: -10 },
        { userId: "b", net: 0 },
      ]),
    ).toEqual([]);
  });
});

describe("tournamentPlacements", () => {
  const ranking = [
    { userId: "a", profit: 300, rank: 1 },
    { userId: "b", profit: 200, rank: 2 },
    { userId: "c", profit: 100, rank: 3 },
    { userId: "d", profit: 10, rank: 4 },
  ];
  it("splits champion / podium / last", () => {
    const r = tournamentPlacements(ranking);
    expect(r.champions).toEqual(["a"]);
    expect(r.podium).toEqual(["a", "b", "c"]);
    expect(r.lastPlace).toEqual(["d"]);
  });
  it("is empty for fewer than 3 players", () => {
    const r = tournamentPlacements(ranking.slice(0, 2));
    expect(r).toEqual({ champions: [], podium: [], lastPlace: [] });
  });
});

describe("currentLeader", () => {
  it("returns rank-1 user when >=3 players", () => {
    expect(
      currentLeader([
        { userId: "a", profit: 1, rank: 1 },
        { userId: "b", profit: 0, rank: 2 },
        { userId: "c", profit: -1, rank: 3 },
      ]),
    ).toBe("a");
  });
  it("returns null for small field", () => {
    expect(currentLeader([{ userId: "a", profit: 1, rank: 1 }])).toBe(null);
  });
});
