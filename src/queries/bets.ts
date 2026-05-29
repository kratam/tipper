import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { db } from "@/db";
import { bets, groupMembers } from "@/db/schema";
import type { Locale } from "@/lib/providers/types";
import { withMatchTeamDisplay } from "@/queries/team-display";

export async function getUserBetsForMatch(userId: string, matchId: string) {
  return db.query.bets.findMany({
    where: and(eq(bets.userId, userId), eq(bets.matchId, matchId)),
    with: {
      group: true,
    },
  });
}

export interface GroupMemberBet {
  betId: string;
  userId: string;
  userName: string;
  userDisplayName: string | null;
  userAvatarUrl: string | null;
  predictedHome: number;
  predictedAway: number;
  stake: number;
  oddsAtBet: string | null;
  result1x2Correct: boolean | null;
  payout: number | null;
}

export interface GroupBetsForMatch {
  groupId: string;
  groupName: string;
  oddsBoost: number;
  bets: GroupMemberBet[];
}

/**
 * Returns all bets on a match grouped by the groups the given user is a member of.
 * Groups with zero bets on the match are still included (empty `bets`) so the UI
 * can render a "nobody tipped" hint.
 */
export async function getGroupBetsForStartedMatch(
  userId: string,
  matchId: string,
): Promise<GroupBetsForMatch[]> {
  const myGroups = await db.query.groupMembers.findMany({
    where: eq(groupMembers.userId, userId),
    with: { group: true },
  });

  if (myGroups.length === 0) return [];

  const groupIds = myGroups.map((m) => m.groupId);

  const matchBets = await db.query.bets.findMany({
    where: and(eq(bets.matchId, matchId), inArray(bets.groupId, groupIds)),
    with: { user: true },
  });

  const betsByGroup = new Map<string, GroupMemberBet[]>();
  for (const bet of matchBets) {
    const existing = betsByGroup.get(bet.groupId) ?? [];
    existing.push({
      betId: bet.id,
      userId: bet.userId,
      userName: bet.user.name,
      userDisplayName: bet.user.displayName,
      userAvatarUrl: bet.user.avatarUrl,
      predictedHome: bet.predictedHome,
      predictedAway: bet.predictedAway,
      stake: bet.stake,
      oddsAtBet: bet.oddsAtBet,
      result1x2Correct: bet.result1x2Correct,
      payout: bet.payout,
    });
    betsByGroup.set(bet.groupId, existing);
  }

  return myGroups
    .map((m) => ({
      groupId: m.groupId,
      groupName: m.group.name,
      oddsBoost: m.group.oddsBoost,
      bets: betsByGroup.get(m.groupId) ?? [],
    }))
    .filter((g) => g.bets.length > 0);
}

export async function getGroupBetsForFinishedMatches(groupId: string) {
  return db.query.bets
    .findMany({
      where: eq(bets.groupId, groupId),
      with: {
        user: true,
        match: true,
      },
    })
    .then((allBets) => allBets.filter((bet) => bet.match.status === "finished"));
}

/**
 * Each bet's `match` team rows are passed through the display mapper for
 * consistency with other read-paths, even though the current tournament-page
 * caller reads only scoring fields. This keeps future UIs that surface the
 * bet's match teams already localized and flag-correct.
 */
export async function getUserBetsForTournament(
  userId: string,
  tournamentId: string,
  useFlagFallback: boolean,
) {
  const locale = (await getLocale()) as Locale;
  const allBets = await db.query.bets.findMany({
    where: eq(bets.userId, userId),
    with: {
      match: {
        with: {
          homeTeam: true,
          awayTeam: true,
          tournament: true,
        },
      },
      group: true,
    },
  });
  return allBets
    .filter((bet) => bet.match.tournamentId === tournamentId)
    .map((bet) => ({
      ...bet,
      match: withMatchTeamDisplay(bet.match, locale, useFlagFallback),
    }));
}
