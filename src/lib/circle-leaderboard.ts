import type { LeaderboardEntry } from "@/lib/leaderboard-utils";

export interface CircleLeaderboardRow extends LeaderboardEntry {
  /** A tag helyezése a teljes hivatalos ranglistán (1..N). */
  officialRank: number;
}

/**
 * A hivatalos ranglista sorait a kör tagjaira szűri, és körön belül 1..n-re
 * rangsorolja, miközben megőrzi az eredeti hivatalos összhelyezést.
 *
 * A bemenet feltételezetten profit szerint csökkenő sorrendű (a getGroupLeaderboard
 * így adja vissza), ezért a szűrés a relatív sorrendet megtartja.
 */
export function filterAndRerankLeaderboard(
  officialRows: readonly LeaderboardEntry[],
  memberIds: ReadonlySet<string>,
): CircleLeaderboardRow[] {
  return officialRows
    .filter((row) => memberIds.has(row.userId))
    .map((row, index) => ({
      ...row,
      officialRank: row.rank,
      rank: index + 1,
    }));
}
