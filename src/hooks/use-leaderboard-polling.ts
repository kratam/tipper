import { useMemo } from "react";
import useSWR from "swr";
import type { LiveLeaderboardRow } from "@/actions/live";
import { getLiveLeaderboard } from "@/actions/live";

const FIVE_MINUTES = 5 * 60 * 1000;

interface LeaderboardRow {
  rank: number;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  balance: number;
}

export function useLeaderboardPolling(
  groupId: string,
  tournamentStatus: string,
  initialData: readonly LeaderboardRow[],
): LeaderboardRow[] {
  const active = tournamentStatus === "active";

  const { data: liveData } = useSWR(
    active ? ["live-leaderboard", groupId] : null,
    () => getLiveLeaderboard(groupId),
    { refreshInterval: active ? FIVE_MINUTES : 0, revalidateOnFocus: true },
  );

  return useMemo(() => {
    if (!liveData) return [...initialData];
    return liveData.map((row: LiveLeaderboardRow) => ({
      rank: row.rank,
      userId: row.userId,
      userName: row.userName,
      userAvatarUrl: row.userAvatarUrl,
      balance: row.balance,
    }));
  }, [initialData, liveData]);
}
