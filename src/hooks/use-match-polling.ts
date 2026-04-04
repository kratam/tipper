import { useMemo } from "react";
import useSWR from "swr";
import type { LiveMatchData } from "@/actions/live";
import { getLiveMatchData } from "@/actions/live";
import type { MatchCardData } from "@/components/match-card";

const TWO_MINUTES = 2 * 60 * 1000;
const FIVE_MINUTES = 5 * 60 * 1000;

function hasLiveMatch(matches: readonly MatchCardData[]): boolean {
  return matches.some((m) => m.status === "live");
}

function hasTodayMatch(matches: readonly MatchCardData[]): boolean {
  const today = new Date().toISOString().split("T")[0];
  return matches.some((m) => m.scheduledAt.startsWith(today));
}

function getPollingInterval(matches: readonly MatchCardData[]): number {
  if (hasLiveMatch(matches)) return TWO_MINUTES;
  if (hasTodayMatch(matches)) return FIVE_MINUTES;
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
  const pollingInterval = useMemo(() => getPollingInterval(matches), [matches]);

  const { data: liveData } = useSWR(
    pollingInterval > 0 ? ["live-matches", tournamentId] : null,
    () => getLiveMatchData(tournamentId),
    { refreshInterval: pollingInterval, revalidateOnFocus: true },
  );

  const mergedMatches = useMemo(() => mergeMatchData(matches, liveData), [matches, liveData]);

  return mergedMatches;
}
