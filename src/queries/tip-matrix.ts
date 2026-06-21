import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { bets } from "@/db/schema";
import {
  deriveRounds,
  filterRoundBetsForViewer,
  isMatchLocked,
  type MatchStatus,
  pickDefaultRoundKey,
  type RoundKind,
  type RoundMatchInput,
} from "@/lib/tip-matrix";
import { getMatchesForTournament } from "@/queries/matches";
import { matchParticipantsKnown } from "@/queries/team-display";

export interface TipMatrixMatch {
  id: string;
  homeTeam: { name: string; logoUrl: string | null };
  awayTeam: { name: string; logoUrl: string | null };
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  scheduledAt: string;
  locked: boolean;
  odds: { homeOdds: string; drawOdds: string; awayOdds: string } | null;
}

export interface TipMatrixBet {
  matchId: string;
  userId: string;
  predictedHome: number;
  predictedAway: number;
  stake: number;
  oddsAtBet: string | null;
  payout: number | null;
  result1x2Correct: boolean | null;
  goalDiffCorrect: boolean | null;
  exactScoreCorrect: boolean | null;
}

export interface TipMatrixRound {
  roundKey: string;
  /** A forduló típusa: round-robin („group") vagy kieséses („knockout"). */
  roundKind: RoundKind;
  /** Csoportköri forduló sorszáma (group), egyébként null. */
  roundGroupNumber: number | null;
  /** A kieséses kör csapatszáma (knockout): 32/16/8/4…, egyébként null. */
  roundKnockoutTeams: number | null;
  /** Az utolsó kieséses kör (döntő). */
  roundIsFinal: boolean;
  orderedRoundKeys: string[];
  matches: TipMatrixMatch[];
  bets: TipMatrixBet[];
}

/**
 * Egy forduló mátrix-adata a megadott csoportra: a forduló meccsei
 * (display-feloldott csapatok, lock-állapot, odds) + a tippek
 * ADATVÉDELMILEG SZŰRVE (jövőbeli meccsen csak a néző saját tippje).
 *
 * A fordulókat a menetrendből vezetjük le (`deriveRounds`), nem a tárolt
 * `round` (= dátum) mezőből: csoportkör = megjelenés-forduló, kieséses =
 * bracket-felezés. `roundKey === null` esetén az alapértelmezett fordulót adja.
 */
export async function getTipMatrixRound(
  groupId: string,
  tournamentId: string,
  useFlagFallback: boolean,
  currentUserId: string,
  roundKey: string | null,
): Promise<TipMatrixRound | null> {
  const now = new Date();
  const allMatches = await getMatchesForTournament(tournamentId, useFlagFallback);

  const roundInputs: RoundMatchInput[] = allMatches.map((m) => ({
    id: m.id,
    scheduledAt: m.scheduledAt,
    homeTeamId: m.homeTeamId,
    awayTeamId: m.awayTeamId,
    participantsKnown: matchParticipantsKnown(m.homeTeam.name, m.awayTeam.name),
  }));

  const rounds = deriveRounds(roundInputs);
  if (rounds.length === 0) return null;

  const startedMatchIds = new Set(
    roundInputs.filter((m) => m.scheduledAt.getTime() <= now.getTime()).map((m) => m.id),
  );
  const selectedKey = roundKey ?? pickDefaultRoundKey(rounds, startedMatchIds);
  const round = rounds.find((r) => r.key === selectedKey) ?? rounds[0];

  const matchById = new Map(allMatches.map((m) => [m.id, m]));
  const roundMatches = round.matchIds
    .map((id) => matchById.get(id))
    .filter((m): m is NonNullable<typeof m> => m != null);

  const tipMatches: TipMatrixMatch[] = roundMatches.map((m) => ({
    id: m.id,
    homeTeam: { name: m.homeTeam.name, logoUrl: m.homeTeam.logoUrl },
    awayTeam: { name: m.awayTeam.name, logoUrl: m.awayTeam.logoUrl },
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    status: m.status as MatchStatus,
    scheduledAt: m.scheduledAt.toISOString(),
    locked: isMatchLocked(m.status as MatchStatus, m.scheduledAt, now),
    odds: m.odds[0]
      ? { homeOdds: m.odds[0].homeOdds, drawOdds: m.odds[0].drawOdds, awayOdds: m.odds[0].awayOdds }
      : null,
  }));

  const lockedMatchIds = new Set(tipMatches.filter((m) => m.locked).map((m) => m.id));

  const roundBetRows =
    round.matchIds.length === 0
      ? []
      : await db.query.bets.findMany({
          where: and(eq(bets.groupId, groupId), inArray(bets.matchId, round.matchIds)),
        });

  const allRoundBets: TipMatrixBet[] = roundBetRows.map((b) => ({
    matchId: b.matchId,
    userId: b.userId,
    predictedHome: b.predictedHome,
    predictedAway: b.predictedAway,
    stake: b.stake,
    oddsAtBet: b.oddsAtBet,
    payout: b.payout,
    result1x2Correct: b.result1x2Correct,
    goalDiffCorrect: b.goalDiffCorrect,
    exactScoreCorrect: b.exactScoreCorrect,
  }));

  const visibleBets = filterRoundBetsForViewer(allRoundBets, lockedMatchIds, currentUserId);

  return {
    roundKey: round.key,
    roundKind: round.kind,
    roundGroupNumber: round.groupNumber,
    roundKnockoutTeams: round.knockoutTeams,
    roundIsFinal: round.isFinal,
    orderedRoundKeys: rounds.map((r) => r.key),
    matches: tipMatches,
    bets: visibleBets,
  };
}
