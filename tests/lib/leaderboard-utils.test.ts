import { describe, expect, it } from "vitest";
import {
  hideInactiveAndRerank,
  type LeaderboardEntry,
  pickMiniLeaderboard,
  splitCuratedRows,
} from "@/lib/leaderboard-utils";

function makeEntry(rank: number, userId: string, profit: number, betCount = 1): LeaderboardEntry {
  return {
    rank,
    userId,
    userName: `User ${userId}`,
    userAvatarUrl: null,
    gravatarHash: null,
    profit,
    betCount,
  };
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

describe("splitCuratedRows", () => {
  const board: LeaderboardEntry[] = [
    makeEntry(1, "a", 300),
    makeEntry(2, "b", 200),
    makeEntry(3, "c", 100),
    makeEntry(4, "d", 50),
    makeEntry(5, "e", 20),
    makeEntry(6, "f", -10),
  ];

  it("user a dobogón: nincs around, a többi rejtett", () => {
    const r = splitCuratedRows(board, "b");
    expect(r.leaders.map((x) => x.userId)).toEqual(["a", "b", "c"]);
    expect(r.around).toEqual([]);
    expect(r.hiddenCount).toBe(3);
  });

  it("user #4: around = [me, mögötte], az ahead leaderként látszik", () => {
    const r = splitCuratedRows(board, "d");
    expect(r.leaders.map((x) => x.userId)).toEqual(["a", "b", "c"]);
    expect(r.around.map((x) => x.userId)).toEqual(["d", "e"]);
    expect(r.hiddenCount).toBe(1); // csak "f"
  });

  it("user #5: around = ±1, nincs rejtett (mindenki látszik)", () => {
    const r = splitCuratedRows(board, "e");
    expect(r.around.map((x) => x.userId)).toEqual(["d", "e", "f"]);
    expect(r.hiddenCount).toBe(0);
  });

  it("user az utolsó: around = [előtte, me]", () => {
    const r = splitCuratedRows(board, "f");
    expect(r.around.map((x) => x.userId)).toEqual(["e", "f"]);
    expect(r.hiddenCount).toBe(1); // "d"
  });

  it("user nincs a listában: csak leaderek", () => {
    const r = splitCuratedRows(board, "x");
    expect(r.leaders.map((x) => x.userId)).toEqual(["a", "b", "c"]);
    expect(r.around).toEqual([]);
    expect(r.hiddenCount).toBe(3);
  });

  it("kevés játékos (< leaders): mindenki leader, nincs rejtett", () => {
    const small = [makeEntry(1, "a", 100), makeEntry(2, "b", 50)];
    const r = splitCuratedRows(small, "b");
    expect(r.leaders.map((x) => x.userId)).toEqual(["a", "b"]);
    expect(r.around).toEqual([]);
    expect(r.hiddenCount).toBe(0);
  });

  it("üres lista", () => {
    const r = splitCuratedRows([], "a");
    expect(r).toEqual({ leaders: [], around: [], hiddenCount: 0 });
  });

  it("nagy mezőny, user a középmezőnyben: rés a leaderek és az around közt + az around alatt", () => {
    const big: LeaderboardEntry[] = Array.from({ length: 10 }, (_, i) =>
      makeEntry(i + 1, `u${i + 1}`, 100 - i),
    );
    const r = splitCuratedRows(big, "u6"); // index 5
    expect(r.leaders.map((x) => x.userId)).toEqual(["u1", "u2", "u3"]);
    expect(r.around.map((x) => x.userId)).toEqual(["u5", "u6", "u7"]);
    expect(r.hiddenCount).toBe(4); // u4 + u8,u9,u10
  });
});

describe("hideInactiveAndRerank", () => {
  it("kiszűri a nem-tippelő (betCount === 0) sorokat, ha van tippelő", () => {
    const board = [makeEntry(1, "a", 500, 2), makeEntry(2, "b", 0, 0), makeEntry(3, "c", -50, 1)];
    const result = hideInactiveAndRerank(board);
    expect(result.map((r) => r.userId)).toEqual(["a", "c"]);
  });

  it("a megmaradó sorokat 1..n-re rangsorolja, a sorrendet megtartva", () => {
    const board = [makeEntry(1, "a", 500, 1), makeEntry(2, "b", 0, 0), makeEntry(3, "c", -50, 1)];
    const result = hideInactiveAndRerank(board);
    expect(result.map((r) => r.rank)).toEqual([1, 2]);
    expect(result.map((r) => r.userId)).toEqual(["a", "c"]);
  });

  it("ha senki sem tippelt, mindenkit megtart (csak újrarangsorol)", () => {
    const board = [makeEntry(1, "a", 0, 0), makeEntry(2, "b", 0, 0)];
    const result = hideInactiveAndRerank(board);
    expect(result.map((r) => r.userId)).toEqual(["a", "b"]);
    expect(result.map((r) => r.rank)).toEqual([1, 2]);
  });

  it("üres listára üres listát ad", () => {
    expect(hideInactiveAndRerank([])).toEqual([]);
  });
});
