import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import type { LiveLeaderboardRow } from "@/actions/live";
import { getLiveLeaderboard } from "@/actions/live";
import { inMatchWindow } from "@/lib/match-poll-window";

// A ranglista élő-frissítése a meccs-pollerrel AZONOS ütemben fut (use-matches.ts
// → 1 perc). Így meccs-lezáráskor a tipp-payout és az összpont/helyezés együtt
// mozog; korábban a leaderboard 5 percenként pollozott, ezért a payout már
// látszott, de a tabella még a régi pontokat mutatta ~5 percig.
const ONE_MINUTE = 60 * 1000;
const TICK_MS = 60 * 1000;

interface LeaderboardRow {
  rank: number;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  profit: number;
  classicPoints?: number;
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
    { refreshInterval: active ? ONE_MINUTE : 0, revalidateOnFocus: true },
  );

  return useMemo(() => {
    if (!liveData) return [...initialData];
    const classicByUser = new Map(initialData.map((r) => [r.userId, r.classicPoints]));
    return liveData.map((row: LiveLeaderboardRow) => ({
      rank: row.rank,
      userId: row.userId,
      userName: row.userName,
      userAvatarUrl: row.userAvatarUrl,
      profit: row.profit,
      classicPoints: classicByUser.get(row.userId) ?? 0,
    }));
  }, [initialData, liveData]);
}
