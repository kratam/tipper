import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { db } from "@/db";
import { bets, groupMembers, matches } from "@/db/schema";
import { gravatarHash } from "@/lib/gravatar-hash";
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
  gravatarHash: string | null;
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
      gravatarHash: gravatarHash(bet.user.email),
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
  // Filter to finished-match bets in SQL (via a matchId subquery) instead of
  // loading every group bet and discarding non-finished ones in memory.
  return db.query.bets.findMany({
    where: and(
      eq(bets.groupId, groupId),
      inArray(
        bets.matchId,
        db.select({ id: matches.id }).from(matches).where(eq(matches.status, "finished")),
      ),
    ),
    with: {
      user: true,
      match: true,
    },
  });
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
  // Restrict to this tournament's matches in SQL (matchId subquery) instead of
  // loading the user's bets across every tournament and filtering in memory.
  const tournamentBets = await db.query.bets.findMany({
    where: and(
      eq(bets.userId, userId),
      inArray(
        bets.matchId,
        db.select({ id: matches.id }).from(matches).where(eq(matches.tournamentId, tournamentId)),
      ),
    ),
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
  return tournamentBets.map((bet) => ({
    ...bet,
    match: withMatchTeamDisplay(bet.match, locale, useFlagFallback),
  }));
}
