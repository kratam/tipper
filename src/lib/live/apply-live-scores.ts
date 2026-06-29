import type { LiveMatchData } from "@/actions/live";
import type { MatchStatus } from "@/lib/tip-matrix";
import type { TipMatrixRound } from "@/queries/tip-matrix";

// A közös `matches` snapshot beolvasztása a tip-mátrix fordulóba: a meccs
// score/status MINDIG a snapshotból (egyetlen igazságforrás), a tipp-payout
// CSAK a néző (currentUserId) saját tippjeire a snapshot userBets-éből. A
// snapshot `userBets`-e KIZÁRÓLAG a néző tippjeit tartalmazza, míg a
// `round.bets` több-felhasználós (minden játékos tippje a lockolt meccsekre);
// ezért a payout-merge-et a néző soraira kell szűkíteni, különben más játékos
// sorát a néző értékeivel írnánk felül. A többi játékos payout-ja a tipMatrix
// query friss lekérésekor frissül. A round szerkezete (ki mit tippelt) változatlan.
//
// A snapshot userBets-e NEM csoport-szűrt: a néző UGYANARRA a meccsre több
// csoportban (hivatalos + saját) is tippelhet, így egy matchId-hez TÖBB userBets
// tartozhat, eltérő payouttal (oddsBoost/stake/bónusz). A tip-mátrix viszont
// csoport-szűrt (round.bets WHERE groupId = X), ezért a néző élő tippjét a
// (currentUserId, groupId) páron kell azonosítani — különben más csoport
// payout-ját/nyerés-színét írnánk a néző cellájába.
export function applyLiveScores(
  round: TipMatrixRound,
  liveData: LiveMatchData[] | undefined,
  currentUserId: string,
  groupId: string,
): TipMatrixRound {
  if (!liveData) return round;

  const liveMatch = new Map(liveData.map((m) => [m.matchId, m]));
  // A snapshot userBets-e a néző sajátja; matchId-re kulcsolva. A tip-mátrix
  // tippnek nincs betId linkje a multi-user round bet-ekhez, ezért a néző
  // saját sorát a (currentUserId, matchId) páron azonosítjuk.
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
      // CSAK a néző saját sorát frissítjük — a snapshot userBets-e a nézőé,
      // más játékos sorát nem szabad a néző payout-jával felülírni.
      if (bet.userId !== currentUserId) return bet;
      const liveBets = livePayoutByMatch.get(bet.matchId);
      if (!liveBets || liveBets.length === 0) return bet;
      // A néző UGYANARRA a meccsre több csoportban is tippelhet, ezért a
      // [0] index önkényes (DB-sorrend) lenne — a néző élő tippjét EBBEN a
      // csoportban a groupId-vel azonosítjuk. Ha nincs ilyen, a sor érintetlen.
      const liveBet = liveBets.find((lb) => lb.groupId === groupId);
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
}
