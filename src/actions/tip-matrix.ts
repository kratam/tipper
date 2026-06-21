"use server";

import { and, eq } from "drizzle-orm";
import type { GroupBetInfo } from "@/components/bet-form";
import type { MatchCardData } from "@/components/match-card";
import { db } from "@/db";
import { groupMembers, groups } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { getUserBetsForMatch } from "@/queries/bets";
import { getBatchProjectedBalances } from "@/queries/groups";
import { getLatestOdds, getMatchesForTournament } from "@/queries/matches";
import { matchParticipantsKnown } from "@/queries/team-display";
import { getTipMatrixRound, type TipMatrixRound } from "@/queries/tip-matrix";

export interface TipMatrixBetInfo {
  match: MatchCardData;
  group: GroupBetInfo;
}

/**
 * Forduló-váltás a Tipp-táblán. Auth + jogosultság: a csoport tagja, vagy
 * publikus csoport (pl. a hivatalos Ranglista). Privát csoport tippjei nem
 * tagnak nem szivárognak ki.
 */
export async function getTipMatrixRoundAction(
  groupId: string,
  roundKey: string | null,
): Promise<TipMatrixRound | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
    with: { tournament: true },
  });
  if (!group) return null;

  if (!group.isPublic) {
    const membership = await db.query.groupMembers.findFirst({
      where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)),
    });
    if (!membership) return null;
  }

  return getTipMatrixRound(
    groupId,
    group.tournamentId,
    group.tournament.useFlagFallback,
    user.id,
    roundKey,
  );
}

/**
 * Tipp-tábla: jövőbeli meccs → tipplap adatok lekérdezése.
 * Auth + tagság kötelező (tipp leadáshoz tagság kell).
 */
export async function getTipMatrixBetInfoAction(
  groupId: string,
  matchId: string,
): Promise<TipMatrixBetInfo | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
    with: { tournament: true },
  });
  if (!group) return null;

  const membership = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)),
  });
  if (!membership) return null;

  const [allMatches, odds, myBets] = await Promise.all([
    getMatchesForTournament(group.tournamentId, group.tournament.useFlagFallback),
    getLatestOdds(matchId),
    getUserBetsForMatch(user.id, matchId),
  ]);

  const m = allMatches.find((x) => x.id === matchId);
  if (!m) return null;

  const balances = await getBatchProjectedBalances(
    user.id,
    [{ id: group.id, initialTokens: group.initialTokens, tokenPerMatch: group.tokenPerMatch }],
    allMatches.map((x) => ({ id: x.id, scheduledAt: x.scheduledAt, status: x.status })),
    group.tournament.timezone,
  );
  const bal = balances[matchId]?.[group.id];
  const existing = myBets.find((b) => b.groupId === group.id);

  const matchCard: MatchCardData = {
    id: m.id,
    homeTeam: { name: m.homeTeam.name, logoUrl: m.homeTeam.logoUrl },
    awayTeam: { name: m.awayTeam.name, logoUrl: m.awayTeam.logoUrl },
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    status: m.status,
    scheduledAt: m.scheduledAt.toISOString(),
    round: m.round,
    participantsKnown: matchParticipantsKnown(m.homeTeam.name, m.awayTeam.name),
    odds: odds
      ? { homeOdds: odds.homeOdds, drawOdds: odds.drawOdds, awayOdds: odds.awayOdds }
      : null,
    userBets: [],
  };

  const groupInfo: GroupBetInfo = {
    groupId: group.id,
    groupName: group.name,
    balance: bal?.actual ?? 0,
    projectedBalance: bal?.projected ?? 0,
    pendingDistributions: bal?.pending ?? 0,
    tokenPerMatch: bal?.tokenPerMatch ?? group.tokenPerMatch,
    initialTokens: bal?.initialTokens ?? group.initialTokens,
    eligibleMatchCount: bal?.eligibleMatchCount ?? 0,
    winnings: bal?.winnings ?? 0,
    losses: bal?.losses ?? 0,
    otherActiveStakes: bal?.otherActiveStakes ?? 0,
    oddsBoost: group.oddsBoost,
    lossPercentage: group.lossPercentage,
    bonusGoalDiff: group.bonusGoalDiff,
    bonusExactScore: group.bonusExactScore,
    bonusPodiumMention: group.bonusPodiumMention,
    bonusPodiumExact: group.bonusPodiumExact,
    existingBet: existing
      ? {
          id: existing.id,
          predictedHome: existing.predictedHome,
          predictedAway: existing.predictedAway,
          stake: existing.stake,
          oddsAtBet: existing.oddsAtBet,
        }
      : null,
    unbettedMatchCountOnDay: 1,
  };

  return { match: matchCard, group: groupInfo };
}
