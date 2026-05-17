import { describe, expect, it } from "vitest";
import { type LeaderboardEntry, pickMiniLeaderboard } from "@/lib/leaderboard-utils";

function makeEntry(rank: number, userId: string, profit: number): LeaderboardEntry {
  return { rank, userId, userName: `User ${userId}`, userAvatarUrl: null, profit };
}

describe("pickMiniLeaderboard", () => {
  const board: LeaderboardEntry[] = [
    makeEntry(1, "a", 300),
    makeEntry(2, "b", 200),
    makeEntry(3, "c", 100),
    makeEntry(4, "d", 50),
    makeEntry(5, "e", 20),
    makeEntry(6, "f", -10),
  ];

  it("returns top 3 when current user is 1st", () => {
    const result = pickMiniLeaderboard(board, "a");
    expect(result.map((r) => r.userId)).toEqual(["a", "b", "c"]);
  });

  it("returns top 3 when current user is 2nd", () => {
    const result = pickMiniLeaderboard(board, "b");
    expect(result.map((r) => r.userId)).toEqual(["a", "b", "c"]);
  });

  it("returns top 3 when current user is 3rd", () => {
    const result = pickMiniLeaderboard(board, "c");
    expect(result.map((r) => r.userId)).toEqual(["a", "b", "c"]);
  });

  it("returns [1st, person ahead, me] when current user is 4th", () => {
    const result = pickMiniLeaderboard(board, "d");
    expect(result.map((r) => r.userId)).toEqual(["a", "c", "d"]);
  });

  it("returns [1st, person ahead, me] when current user is 6th", () => {
    const result = pickMiniLeaderboard(board, "f");
    expect(result.map((r) => r.userId)).toEqual(["a", "e", "f"]);
  });

  it("returns top 3 when current user is not in the leaderboard", () => {
    const result = pickMiniLeaderboard(board, "unknown");
    expect(result.map((r) => r.userId)).toEqual(["a", "b", "c"]);
  });

  it("returns all entries when leaderboard has fewer than 3", () => {
    const small = [makeEntry(1, "a", 100), makeEntry(2, "b", 50)];
    const result = pickMiniLeaderboard(small, "b");
    expect(result.map((r) => r.userId)).toEqual(["a", "b"]);
  });

  it("returns empty array for empty leaderboard", () => {
    const result = pickMiniLeaderboard([], "a");
    expect(result).toEqual([]);
  });

  describe("with size=5", () => {
    const longBoard: LeaderboardEntry[] = [
      makeEntry(1, "a", 500),
      makeEntry(2, "b", 400),
      makeEntry(3, "c", 300),
      makeEntry(4, "d", 200),
      makeEntry(5, "e", 100),
      makeEntry(6, "f", 50),
      makeEntry(7, "g", 0),
      makeEntry(8, "h", -50),
    ];

    it("returns top 5 when current user is in top 5", () => {
      const result = pickMiniLeaderboard(longBoard, "c", 5);
      expect(result.map((r) => r.userId)).toEqual(["a", "b", "c", "d", "e"]);
    });

    it("returns [top 3, ahead, me] when current user is 8th", () => {
      const result = pickMiniLeaderboard(longBoard, "h", 5);
      expect(result.map((r) => r.userId)).toEqual(["a", "b", "c", "g", "h"]);
    });

    it("returns all entries when leaderboard has fewer than 5", () => {
      const small = longBoard.slice(0, 4);
      const result = pickMiniLeaderboard(small, "d", 5);
      expect(result.map((r) => r.userId)).toEqual(["a", "b", "c", "d"]);
    });
  });
});
