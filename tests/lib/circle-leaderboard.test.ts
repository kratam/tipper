import { describe, expect, it } from "vitest";
import { filterAndRerankLeaderboard } from "@/lib/circle-leaderboard";

const officialRows = [
  { rank: 1, userId: "a", userName: "Anna", userAvatarUrl: null, profit: 500, betCount: 1 },
  { rank: 2, userId: "b", userName: "Bea", userAvatarUrl: null, profit: 300, betCount: 1 },
  { rank: 3, userId: "c", userName: "Cili", userAvatarUrl: null, profit: 100, betCount: 1 },
  { rank: 4, userId: "d", userName: "Dani", userAvatarUrl: null, profit: -50, betCount: 1 },
];

describe("filterAndRerankLeaderboard", () => {
  it("keeps only circle members and re-ranks them 1..n", () => {
    const result = filterAndRerankLeaderboard(officialRows, new Set(["b", "d"]));
    expect(result).toEqual([
      {
        rank: 1,
        officialRank: 2,
        userId: "b",
        userName: "Bea",
        userAvatarUrl: null,
        profit: 300,
        betCount: 1,
      },
      {
        rank: 2,
        officialRank: 4,
        userId: "d",
        userName: "Dani",
        userAvatarUrl: null,
        profit: -50,
        betCount: 1,
      },
    ]);
  });

  it("preserves official source order (profit desc) when re-ranking", () => {
    const result = filterAndRerankLeaderboard(officialRows, new Set(["c", "a"]));
    expect(result.map((r) => r.userId)).toEqual(["a", "c"]);
    expect(result.map((r) => r.rank)).toEqual([1, 2]);
    expect(result.map((r) => r.officialRank)).toEqual([1, 3]);
  });

  it("returns empty array when no members match", () => {
    expect(filterAndRerankLeaderboard(officialRows, new Set(["zzz"]))).toEqual([]);
  });

  it("handles a single-member circle", () => {
    const result = filterAndRerankLeaderboard(officialRows, new Set(["c"]));
    expect(result).toEqual([
      {
        rank: 1,
        officialRank: 3,
        userId: "c",
        userName: "Cili",
        userAvatarUrl: null,
        profit: 100,
        betCount: 1,
      },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(filterAndRerankLeaderboard([], new Set(["a"]))).toEqual([]);
  });

  it("kiszűri a nem-tippelő kör-tagot, ha van tippelő tag", () => {
    const rows = [
      { rank: 1, userId: "a", userName: "A", userAvatarUrl: null, profit: 500, betCount: 1 },
      { rank: 2, userId: "c", userName: "C", userAvatarUrl: null, profit: 100, betCount: 1 },
      { rank: 3, userId: "b", userName: "B", userAvatarUrl: null, profit: 0, betCount: 0 },
      { rank: 4, userId: "d", userName: "D", userAvatarUrl: null, profit: -50, betCount: 1 },
    ];
    const result = filterAndRerankLeaderboard(rows, new Set(["c", "b", "d"]));
    expect(result.map((r) => r.userId)).toEqual(["c", "d"]);
    expect(result.map((r) => r.rank)).toEqual([1, 2]);
  });

  it("officialRank a csoport-szintű SZŰRT ranglistából jön (nem a nyers rangból)", () => {
    // 'b' nem tippelt → a szűrt csoport-listában 'c' a 2. (nem a 3.).
    const rows = [
      { rank: 1, userId: "a", userName: "A", userAvatarUrl: null, profit: 500, betCount: 1 },
      { rank: 2, userId: "b", userName: "B", userAvatarUrl: null, profit: 0, betCount: 0 },
      { rank: 3, userId: "c", userName: "C", userAvatarUrl: null, profit: -50, betCount: 1 },
    ];
    const result = filterAndRerankLeaderboard(rows, new Set(["c"]));
    expect(result).toEqual([
      {
        rank: 1,
        officialRank: 2,
        userId: "c",
        userName: "C",
        userAvatarUrl: null,
        profit: -50,
        betCount: 1,
      },
    ]);
  });

  it("kör edge case: ha a kör tagjai közül senki sem tippelt, mind látszik", () => {
    // A csoportban 'a' tippelt, de a kör tagja csak a nem-tippelő 'b'.
    const rows = [
      { rank: 1, userId: "a", userName: "A", userAvatarUrl: null, profit: 500, betCount: 1 },
      { rank: 2, userId: "b", userName: "B", userAvatarUrl: null, profit: 0, betCount: 0 },
    ];
    const result = filterAndRerankLeaderboard(rows, new Set(["b"]));
    expect(result.map((r) => r.userId)).toEqual(["b"]);
    expect(result[0].rank).toBe(1);
    expect(result[0].officialRank).toBe(2); // fallback a nyers rangra
  });
});
