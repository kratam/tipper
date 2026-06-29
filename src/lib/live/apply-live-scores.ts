import type { LiveMatchData } from "@/actions/live";
import type { MatchStatus } from "@/lib/tip-matrix";
import type { TipMatrixRound } from "@/queries/tip-matrix";

// A közös `matches` snapshot beolvasztása a tip-mátrix fordulóba: a meccs
// score/status MINDIG a snapshotból (egyetlen igazságforrás), a tipp-payout a
// néző saját tippjeire a snapshot userBets-éből. A többi játékos payout-ja a
// tipMatrix query friss lekérésekor frissül. A round szerkezete (ki mit
// tippelt) változatlan.
export function applyLiveScores(
  round: TipMatrixRound,
  liveData: LiveMatchData[] | undefined,
): TipMatrixRound {
  if (!liveData) return round;

  const liveMatch = new Map(liveData.map((m) => [m.matchId, m]));
  // payout-kulcs: (matchId, betId) — de a tip-mátrix tippnek nincs betId-je,
  // ezért a néző saját tippjeit a snapshot matchId-jén belül egyetlen
  // userBets-elemmel párosítjuk, ha az adott meccsre a néző tippelt.
  const livePayoutByMatch = new Map(liveData.map((m) => [m.matchId, m.userBets]));

  return {
    ...round,
    matches: round.matches.map((m) => {
      const live = liveMatch.get(m.id);
      if (!live) return m;
      return {
        ...m,
        homeScore: live.homeScore,
        awayScore: live.awayScore,
        status: live.status as MatchStatus,
      };
    }),
    bets: round.bets.map((bet) => {
      const liveBets = livePayoutByMatch.get(bet.matchId);
      if (!liveBets || liveBets.length === 0) return bet;
      // A snapshot userBets-e a néző sajátja; a tip-mátrixban a néző sorát a
      // matchId azonosítja (egy meccsre egy tipp / játékos). Csak akkor írunk
      // payout-ot, ha van snapshot-tipp erre a meccsre.
      const liveBet = liveBets[0];
      return {
        ...bet,
        result1x2Correct: liveBet.result1x2Correct,
        goalDiffCorrect: liveBet.goalDiffCorrect,
        exactScoreCorrect: liveBet.exactScoreCorrect,
        payout: liveBet.payout,
      };
    }),
  };
}
