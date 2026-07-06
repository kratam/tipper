import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { bets, circleMembers, groupMembers, groups, users } from "@/db/schema";
import { pickGoogleAvatarUrl } from "@/lib/avatar-detect";
import type { StoredBadge } from "@/lib/badges/evaluate";
import { gravatarHash } from "@/lib/gravatar-hash";
import type { Locale } from "@/lib/providers/types";
import { loadBadgesForUsers } from "@/queries/badges";
import { withTeamDisplay } from "@/queries/team-display";

export interface StatMatchTeam {
  name: string;
  logoUrl: string | null;
}

export interface StatMatch {
  home: StatMatchTeam;
  away: StatMatchTeam;
  homeScore: number | null;
  awayScore: number | null;
}

export interface ProfileView {
  displayName: string;
  avatarUrl: string | null;
  gravatarHash: string | null;
  badges: Array<StoredBadge & { badgeKey: string }>;
  stats: {
    totalBets: number;
    hitRate: number;
    avgStake: number;
    maxStake: number;
    maxStakeMatch: StatMatch | null;
    biggestWin: number;
    biggestWinMatch: StatMatch | null;
    biggestLoss: number;
    biggestLossMatch: StatMatch | null;
  };
}

/**
 * Igaz, ha viewerId láthatja userId profilját:
 * - Saját profil (userId === viewerId)
 * - Közös official csoport (Ranglista)
 * - Közös kör
 */
export async function shareACircleOrLeague(userId: string, viewerId: string): Promise<boolean> {
  if (userId === viewerId) return true;

  // userId official csoportjainak listája
  const userLeagueIds = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .innerJoin(groups, and(eq(groups.id, groupMembers.groupId), eq(groups.isOfficial, true)))
    .where(eq(groupMembers.userId, userId))
    .then((rows) => rows.map((r) => r.groupId));

  if (userLeagueIds.length > 0) {
    const viewerLeagueMemberships = await db
      .select({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .where(and(eq(groupMembers.userId, viewerId), inArray(groupMembers.groupId, userLeagueIds)));
    if (viewerLeagueMemberships.length > 0) return true;
  }

  // userId köreinek listája
  const userCircleIds = await db
    .select({ circleId: circleMembers.circleId })
    .from(circleMembers)
    .where(eq(circleMembers.userId, userId))
    .then((rows) => rows.map((r) => r.circleId));

  if (userCircleIds.length > 0) {
    const viewerCircleMemberships = await db
      .select({ circleId: circleMembers.circleId })
      .from(circleMembers)
      .where(
        and(eq(circleMembers.userId, viewerId), inArray(circleMembers.circleId, userCircleIds)),
      );
    if (viewerCircleMemberships.length > 0) return true;
  }

  return false;
}

/**
 * Visszaadja a felhasználó profilját, vagy null-t ha a viewer nem láthatja
 * (nem osztanak sem official Ranglistát, sem kört).
 */
export async function getProfile(
  userId: string,
  viewerId: string,
  locale: Locale,
): Promise<ProfileView | null> {
  const canView = await shareACircleOrLeague(userId, viewerId);
  if (!canView) return null;

  // Felhasználó alapadatok
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return null;

  // Badgek
  const badgeMap = await loadBadgesForUsers([userId]);
  const userBadges = badgeMap.get(userId) ?? [];

  // Tipp-statisztikák: csak a hivatalos Ranglista (isOfficial) tippjeiből,
  // szándékosan a badge-ekkel NEM átfedő mutatók (tét / nyeremény / bukó).
  // Egy user profilja kevés tipp (≈ pár száz), ezért egyetlen relációs
  // lekérdezéssel behúzzuk a meccs-adatokkal együtt, és az extrémumokat
  // (legnagyobb tét / nyeremény / bukó) JS-ben választjuk ki — így a hozzájuk
  // tartozó MECCS is megvan. A nettó egy tippre = payout - stake.
  const officialGroupIds = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.isOfficial, true))
    .then((rows) => rows.map((r) => r.id));

  const emptyStats = {
    totalBets: 0,
    hitRate: 0,
    avgStake: 0,
    maxStake: 0,
    maxStakeMatch: null,
    biggestWin: 0,
    biggestWinMatch: null,
    biggestLoss: 0,
    biggestLossMatch: null,
  } satisfies ProfileView["stats"];

  if (officialGroupIds.length === 0) {
    return {
      displayName: user.displayName ?? user.name,
      avatarUrl: pickGoogleAvatarUrl(user.avatarUrl, user.avatarIsReal),
      gravatarHash: gravatarHash(user.email),
      badges: userBadges,
      stats: emptyStats,
    };
  }

  const userBets = await db.query.bets.findMany({
    where: and(eq(bets.userId, userId), inArray(bets.groupId, officialGroupIds)),
    with: {
      match: {
        with: {
          homeTeam: { columns: { name: true, logoUrl: true } },
          awayTeam: { columns: { name: true, logoUrl: true } },
          tournament: { columns: { useFlagFallback: true } },
        },
      },
    },
  });

  type ProfileBet = (typeof userBets)[number];
  const netOf = (b: ProfileBet) => (b.payout ?? 0) - b.stake;
  const toStatMatch = (b: ProfileBet): StatMatch => {
    const { match } = b;
    const ff = match.tournament.useFlagFallback;
    const home = withTeamDisplay(match.homeTeam, locale, ff);
    const away = withTeamDisplay(match.awayTeam, locale, ff);
    return {
      home: { name: home.name, logoUrl: home.logoUrl },
      away: { name: away.name, logoUrl: away.logoUrl },
      homeScore: match.homeScore,
      awayScore: match.awayScore,
    };
  };

  const totalBets = userBets.length;
  const resolved = userBets.filter((b) => b.payout !== null);
  const won = resolved.filter((b) => b.result1x2Correct === true).length;
  const hitRateValue = resolved.length > 0 ? Math.round((100 * won) / resolved.length) : 0;
  const avgStake =
    totalBets > 0 ? Math.round(userBets.reduce((s, b) => s + b.stake, 0) / totalBets) : 0;

  let maxStakeBet: ProfileBet | null = null;
  let bestWinBet: ProfileBet | null = null;
  let worstLossBet: ProfileBet | null = null;
  for (const b of userBets) {
    if (!maxStakeBet || b.stake > maxStakeBet.stake) maxStakeBet = b;
  }
  for (const b of resolved) {
    if (!bestWinBet || netOf(b) > netOf(bestWinBet)) bestWinBet = b;
    if (!worstLossBet || netOf(b) < netOf(worstLossBet)) worstLossBet = b;
  }

  const biggestWin = bestWinBet ? netOf(bestWinBet) : 0;
  const biggestLoss = worstLossBet ? netOf(worstLossBet) : 0;

  return {
    displayName: user.displayName ?? user.name,
    avatarUrl: pickGoogleAvatarUrl(user.avatarUrl, user.avatarIsReal),
    gravatarHash: gravatarHash(user.email),
    badges: userBadges,
    stats: {
      totalBets,
      hitRate: hitRateValue,
      avgStake,
      maxStake: maxStakeBet?.stake ?? 0,
      maxStakeMatch: maxStakeBet ? toStatMatch(maxStakeBet) : null,
      biggestWin,
      biggestWinMatch: biggestWin > 0 && bestWinBet ? toStatMatch(bestWinBet) : null,
      biggestLoss,
      biggestLossMatch: biggestLoss < 0 && worstLossBet ? toStatMatch(worstLossBet) : null,
    },
  };
}

/**
 * Batch-betölti a játékosok tipp-statisztikáit (Official Ranglista körökből).
 * Visszaad: totalBets (összes leadott tipp) + hitRate (0–100, egész).
 */
export async function loadPlayerStatsForUsers(
  userIds: string[],
): Promise<Map<string, { totalBets: number; hitRate: number }>> {
  const result = new Map<string, { totalBets: number; hitRate: number }>();
  if (userIds.length === 0) return result;

  const rows = await db
    .select({
      userId: bets.userId,
      totalBets: sql<number>`cast(count(*) as int)`,
      resolved: sql<number>`cast(count(*) filter (where ${bets.payout} is not null) as int)`,
      won: sql<number>`cast(count(*) filter (where ${bets.result1x2Correct} = true) as int)`,
    })
    .from(bets)
    .innerJoin(groups, and(eq(groups.id, bets.groupId), eq(groups.isOfficial, true)))
    .where(inArray(bets.userId, userIds))
    .groupBy(bets.userId);

  for (const row of rows) {
    const hitRateValue = row.resolved > 0 ? Math.round((100 * row.won) / row.resolved) : 0;
    result.set(row.userId, { totalBets: row.totalBets, hitRate: hitRateValue });
  }
  return result;
}
