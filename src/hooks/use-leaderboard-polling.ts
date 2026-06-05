import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import type { LiveLeaderboardRow } from "@/actions/live";
import { getLiveLeaderboard } from "@/actions/live";
import { inMatchWindow } from "@/lib/leaderboard-poll-window";

const FIVE_MINUTES = 5 * 60 * 1000;
const TICK_MS = 60 * 1000;

interface LeaderboardRow {
  rank: number;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  profit: number;
}

export function useLeaderboardPolling(
  groupId: string,
  matchTimes: readonly number[],
  initialData: readonly LeaderboardRow[],
): LeaderboardRow[] {
  // A meccs-ablakot percenként újraértékeljük, hogy egy nyitva felejtett tab
  // magától LEÁLLJON, amikor az ablak bezárul, és magától INDULJON, amikor egy
  // meccs közeleg — mindezt DB-hívás nélkül (tiszta kliens-időzítő).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const active = useMemo(() => inMatchWindow(matchTimes, now), [matchTimes, now]);

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
      profit: row.profit,
    }));
  }, [initialData, liveData]);
}
