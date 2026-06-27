import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { bets, circleMembers, groupMembers, groups, users } from "@/db/schema";
import type { StoredBadge } from "@/lib/badges/evaluate";
import { hitRate } from "@/lib/profile-stats";
import { loadBadgesForUsers } from "@/queries/badges";

export interface ProfileView {
  displayName: string;
  avatarUrl: string | null;
  badges: Array<StoredBadge & { badgeKey: string }>;
  stats: {
    totalBets: number;
    hitRate: number;
    bestWinStreak: number;
    biggestJackpotOdds: number | null;
    placements: {
      champion: number;
      podium: number;
    };
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
export async function getProfile(userId: string, viewerId: string): Promise<ProfileView | null> {
  const canView = await shareACircleOrLeague(userId, viewerId);
  if (!canView) return null;

  // Felhasználó alapadatok
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return null;

  // Badgek
  const badgeMap = await loadBadgesForUsers([userId]);
  const userBadges = badgeMap.get(userId) ?? [];

  // Tipp-statisztikák: csak official csoportokban leadott tippek
  const officialGroupIds = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.isOfficial, true))
    .then((rows) => rows.map((r) => r.id));

  let totalBets = 0;
  let hitRateValue = 0;

  if (officialGroupIds.length > 0) {
    const userBetRows = await db
      .select({ result1x2Correct: bets.result1x2Correct })
      .from(bets)
      .where(and(eq(bets.userId, userId), inArray(bets.groupId, officialGroupIds)));

    totalBets = userBetRows.length;
    hitRateValue = hitRate(userBetRows);
  }

  // Win streak és jackpot a badge row-okból (nem újraszámítjuk)
  const winStreakBadge = userBadges.find((b) => b.badgeKey === "win_streak");
  const jackpotBadge = userBadges.find((b) => b.badgeKey === "jackpot");

  // Helyezések: champion / podium badgekből
  const championBadge = userBadges.find((b) => b.badgeKey === "champion");
  const podiumBadge = userBadges.find((b) => b.badgeKey === "podium");

  return {
    displayName: user.displayName ?? user.name,
    avatarUrl: user.avatarUrl ?? null,
    badges: userBadges,
    stats: {
      totalBets,
      hitRate: hitRateValue,
      bestWinStreak: winStreakBadge?.count ?? 0,
      biggestJackpotOdds: jackpotBadge?.bestValue ?? null,
      placements: {
        champion: championBadge?.count ?? 0,
        podium: podiumBadge?.count ?? 0,
      },
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
