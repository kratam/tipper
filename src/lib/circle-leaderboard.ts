import { hideInactiveAndRerank, type LeaderboardEntry } from "@/lib/leaderboard-utils";

export interface CircleLeaderboardRow extends LeaderboardEntry {
  /** A tag helyezése a (szűrt) teljes hivatalos ranglistán (1..N). */
  officialRank: number;
}

/**
 * A hivatalos ranglista sorait a kör tagjaira szűri, kiszűri a kör még nem
 * tippelt tagjait (kivéve, ha a kör tagjai közül SENKI sem tippelt — akkor mind
 * látszik), és körön belül 1..n-re rangsorol. Az `officialRank` a tag helye a
 * csoport-szintű szűrt hivatalos ranglistán.
 *
 * A bemenet feltételezetten profit szerint csökkenő sorrendű (a
 * getGroupLeaderboard így adja vissza), ezért a szűrés a relatív sorrendet
 * megtartja.
 */
export function filterAndRerankLeaderboard(
  officialRows: readonly LeaderboardEntry[],
  memberIds: ReadonlySet<string>,
): CircleLeaderboardRow[] {
  // A csoport-szintű szűrt+rerankelt ranglista adja a helyes officialRank-eket.
  const officialActive = hideInactiveAndRerank(officialRows);
  const officialRankById = new Map(officialActive.map((r) => [r.userId, r.rank]));

  const memberRows = officialRows.filter((row) => memberIds.has(row.userId));
  const anyMemberActive = memberRows.some((row) => row.betCount > 0);
  const keptMembers = anyMemberActive ? memberRows.filter((row) => row.betCount > 0) : memberRows;

  return keptMembers.map((row, index) => ({
    ...row,
    officialRank: officialRankById.get(row.userId) ?? row.rank,
    rank: index + 1,
  }));
}
