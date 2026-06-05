import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import type { LiveMatchData } from "@/actions/live";
import { getLiveMatchData } from "@/actions/live";
import type { MatchCardData } from "@/components/match-card";
import { inMatchWindow } from "@/lib/match-poll-window";

const TWO_MINUTES = 2 * 60 * 1000;
const FIVE_MINUTES = 5 * 60 * 1000;
const TICK_MS = 60 * 1000;

function hasLiveMatch(matches: readonly MatchCardData[]): boolean {
  return matches.some((m) => m.status === "live");
}

function getPollingInterval(matches: readonly MatchCardData[], now: number): number {
  if (hasLiveMatch(matches)) return TWO_MINUTES;
  const matchTimes = matches.map((m) => Date.parse(m.scheduledAt));
  if (inMatchWindow(matchTimes, now)) return FIVE_MINUTES;
  return 0;
}

function mergeMatchData(
  matches: readonly MatchCardData[],
  liveData: LiveMatchData[] | undefined,
): MatchCardData[] {
  if (!liveData) return [...matches];

  const liveMap = new Map(liveData.map((m) => [m.matchId, m]));

  return matches.map((match) => {
    const live = liveMap.get(match.id);
    if (!live) return match;

    return {
      ...match,
      homeScore: live.homeScore,
      awayScore: live.awayScore,
      status: live.status,
      userBets: match.userBets.map((bet) => {
        const liveBet = live.userBets.find((lb) => lb.betId === bet.id);
        if (!liveBet) return bet;
        return {
          ...bet,
          result1x2Correct: liveBet.result1x2Correct,
          goalDiffCorrect: liveBet.goalDiffCorrect,
          exactScoreCorrect: liveBet.exactScoreCorrect,
          payout: liveBet.payout,
        };
      }),
    };
  });
}

export function useMatchPolling(tournamentId: string, matches: readonly MatchCardData[]) {
  // A meccs-ablakot percenként újraértékeljük, hogy egy nyitva felejtett tab
  // DB-hívás nélkül le-/felpörögjön, amikor az ablak be-/kinyílik.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const pollingInterval = useMemo(() => getPollingInterval(matches, now), [matches, now]);

  const { data: liveData } = useSWR(
    pollingInterval > 0 ? ["live-matches", tournamentId] : null,
    () => getLiveMatchData(tournamentId),
    { refreshInterval: pollingInterval, revalidateOnFocus: true },
  );

  const mergedMatches = useMemo(() => mergeMatchData(matches, liveData), [matches, liveData]);

  return mergedMatches;
}
