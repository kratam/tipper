import type { LiveMatchData } from "@/actions/live";
import type { MatchCardData } from "@/components/match-card";

// A torna-szintű élő snapshot (score/status/tipp-payout) beolvasztása a
// statikus meccs-kártya adatba. Pure: ugyanazt a `matches` snapshotot
// használja a MatchCard és a TipMatrix is → egyetlen igazságforrás.
export function mergeMatchData(
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
