import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { db } from "@/db";
import { bets, groupMembers, matches } from "@/db/schema";
import { pickGoogleAvatarUrl } from "@/lib/avatar-detect";
import { gravatarHash } from "@/lib/gravatar-hash";
import type { Locale } from "@/lib/providers/types";
import { computePoolBase } from "@/lib/scoring";
import { computeMatchesToDate, dateToDateNum } from "@/lib/tokens";
import { getBettorResolvedNets } from "@/queries/bonus-pool";
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
  goalDiffCorrect: boolean | null;
  exactScoreCorrect: boolean | null;
  payout: number | null;
}

export interface GroupBetsForMatch {
  groupId: string;
  groupName: string;
  oddsBoost: number;
  /** A dinamikus bónusz-pool alapja (a meccs tippelőinek játékban lévő tokenjei).
   *  A Statisztika-tab ebből + a pct-kből számolja a pool-keretet és — lezárt
   *  meccsnél — az egy főre eső kifizetést. A scoringgal azonos képlet. */
  poolBase: number;
  bonusGoalDiffPct: number;
  bonusExactScorePct: number;
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

  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
    columns: { scheduledAt: true, tournamentId: true },
    with: { tournament: { columns: { timezone: true } } },
  });
  if (!match) return [];
  const timeZone = match.tournament.timezone;
  const matchDateNum = dateToDateNum(match.scheduledAt, timeZone);
  const tournamentMatches = await db.query.matches.findMany({
    where: eq(matches.tournamentId, match.tournamentId),
    columns: { scheduledAt: true, status: true },
  });
  const matchesToDate = computeMatchesToDate(tournamentMatches, timeZone, matchDateNum);

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
      userAvatarUrl: pickGoogleAvatarUrl(bet.user.avatarUrl, bet.user.avatarIsReal),
      gravatarHash: gravatarHash(bet.user.email),
      predictedHome: bet.predictedHome,
      predictedAway: bet.predictedAway,
      stake: bet.stake,
      oddsAtBet: bet.oddsAtBet,
      result1x2Correct: bet.result1x2Correct,
      goalDiffCorrect: bet.goalDiffCorrect,
      exactScoreCorrect: bet.exactScoreCorrect,
      payout: bet.payout,
    });
    betsByGroup.set(bet.groupId, existing);
  }

  // Csak a tippekkel bíró csoportokra számolunk pool-alapot (a getBettorResolvedNets
  // csoportonként egy lekérdezés). A poolBase a scoringgal azonos képlettel áll
  // elő, így a Statisztika-tab kerete a tényleges kifizetéssel egyezik.
  const withBets = myGroups.filter((m) => (betsByGroup.get(m.groupId)?.length ?? 0) > 0);

  return Promise.all(
    withBets.map(async (m) => {
      const groupBets = betsByGroup.get(m.groupId) ?? [];
      const bettorIds = [...new Set(groupBets.map((b) => b.userId))];
      const netsByUser = await getBettorResolvedNets(m.groupId, bettorIds, timeZone, matchDateNum);
      const poolBase = computePoolBase({
        initialTokens: m.group.initialTokens,
        tokenPerMatch: m.group.tokenPerMatch,
        matchesToDate,
        bettorResolvedNets: bettorIds.map((id) => netsByUser.get(id) ?? 0),
      });

      return {
        groupId: m.groupId,
        groupName: m.group.name,
        oddsBoost: m.group.oddsBoost,
        poolBase,
        bonusGoalDiffPct: m.group.bonusGoalDiffPct,
        bonusExactScorePct: m.group.bonusExactScorePct,
        bets: groupBets,
      };
    }),
  );
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
