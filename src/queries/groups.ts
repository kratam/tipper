import "server-only";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { bets, groupMembers, groups, matches, tokenLedger } from "@/db/schema";

export async function getUserGroups(userId: string) {
  return db.query.groupMembers.findMany({
    where: eq(groupMembers.userId, userId),
    with: {
      group: {
        with: {
          tournament: true,
          owner: true,
          members: true,
        },
      },
    },
  });
}

export async function getGroupBySlug(slug: string) {
  return db.query.groups.findFirst({
    where: eq(groups.slug, slug),
    with: {
      tournament: true,
      owner: true,
      members: {
        with: {
          user: true,
        },
      },
    },
  });
}

export async function getGroupByInviteCode(code: string) {
  return db.query.groups.findFirst({
    where: eq(groups.inviteCode, code),
    with: {
      tournament: true,
    },
  });
}

export async function getTokenBalance(userId: string, groupId: string): Promise<number> {
  const result = await db
    .select({
      balance: sql<number>`COALESCE(SUM(${tokenLedger.amount}), 0)`,
    })
    .from(tokenLedger)
    .where(and(eq(tokenLedger.userId, userId), eq(tokenLedger.groupId, groupId)));

  return Number(result[0]?.balance ?? 0);
}

/**
 * Calculate projected balance for a user in a group for a specific match day.
 * projected = actual + pending_up_to_day × tokenPerMatch - futureBetsNet
 *
 * Day-scoped pending ensures future-day tokens can't be spent on earlier days.
 * The futureBetsNet correction undoes the effect of bets placed on later-day
 * matches — those bets reduced actual but are backed by later distributions,
 * so they shouldn't limit the current day's budget.
 */
export async function getProjectedBalance(
  userId: string,
  groupId: string,
  matchId: string,
): Promise<{ projected: number; actual: number; pending: number; tokenPerMatch: number }> {
  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
  });
  if (!group) return { projected: 0, actual: 0, pending: 0, tokenPerMatch: 0 };

  const targetMatch = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
  });
  if (!targetMatch)
    return { projected: 0, actual: 0, pending: 0, tokenPerMatch: group.tokenPerMatch };

  const actual = await getTokenBalance(userId, groupId);

  // Pending distributions for matches on Day ≤ target day
  const pendingResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(matches)
    .where(
      and(
        eq(matches.tournamentId, group.tournamentId),
        eq(matches.status, "scheduled"),
        sql`DATE(${matches.scheduledAt}) <= DATE(${targetMatch.scheduledAt})`,
        sql`NOT EXISTS (
          SELECT 1 FROM token_ledger tl
          WHERE tl.user_id = ${userId}
            AND tl.group_id = ${groupId}
            AND tl.type = 'distribution'
            AND tl.reference_id = ${matches.id}
        )`,
      ),
    );
  const pending = Number(pendingResult[0].count);

  // Correction: net effect of bets/refunds on matches AFTER target day.
  // These reduced actual but are backed by later-day distributions,
  // so subtract them to restore the current day's true budget.
  const futureBetsResult = await db
    .select({
      net: sql<number>`COALESCE(SUM(${tokenLedger.amount}), 0)`,
    })
    .from(tokenLedger)
    .innerJoin(bets, eq(tokenLedger.referenceId, bets.id))
    .innerJoin(matches, eq(bets.matchId, matches.id))
    .where(
      and(
        eq(tokenLedger.userId, userId),
        eq(tokenLedger.groupId, groupId),
        inArray(tokenLedger.type, ["bet", "refund"]),
        sql`DATE(${matches.scheduledAt}) > DATE(${targetMatch.scheduledAt})`,
      ),
    );
  const futureBetsNet = Number(futureBetsResult[0]?.net ?? 0);

  // Day-scoped actual: exclude the effect of future-day bets
  const dayActual = actual - futureBetsNet;
  const projected = dayActual + pending * group.tokenPerMatch;

  return { projected, actual: dayActual, pending, tokenPerMatch: group.tokenPerMatch };
}

/**
 * Profit from resolved matches: sum of bet/win/refund ledger entries
 * where the linked match is finished or cancelled.
 * Win: -stake + payout = net gain. Loss: -stake. Cancelled: -stake + stake = 0.
 */
export async function getUserProfit(userId: string, groupId: string): Promise<number> {
  const result = await db
    .select({
      profit: sql<number>`COALESCE(SUM(CASE WHEN ${matches.status} IN ('finished', 'cancelled') THEN ${tokenLedger.amount} ELSE 0 END), 0)`,
    })
    .from(tokenLedger)
    .leftJoin(bets, eq(tokenLedger.referenceId, bets.id))
    .leftJoin(matches, eq(bets.matchId, matches.id))
    .where(
      and(
        eq(tokenLedger.userId, userId),
        eq(tokenLedger.groupId, groupId),
        inArray(tokenLedger.type, ["bet", "win", "refund"]),
      ),
    );

  return Number(result[0]?.profit ?? 0);
}

/**
 * Batch-compute projected balances for all (group, match) pairs in 3 DB queries.
 * Returns result[matchId][groupId] = { projected, actual, pending, tokenPerMatch }
 *
 * Replaces N×M sequential getProjectedBalance calls on the tournament page.
 */
export async function getBatchProjectedBalances(
  userId: string,
  groupsData: Array<{ id: string; tokenPerMatch: number }>,
  allMatches: Array<{ id: string; scheduledAt: Date; status: string }>,
): Promise<
  Record<
    string,
    Record<string, { projected: number; actual: number; pending: number; tokenPerMatch: number }>
  >
> {
  if (groupsData.length === 0 || allMatches.length === 0) return {};

  const groupIds = groupsData.map((g) => g.id);

  // Query 1: actual balances per group
  const balanceRows = await db
    .select({
      groupId: tokenLedger.groupId,
      balance: sql<number>`COALESCE(SUM(${tokenLedger.amount}), 0)`,
    })
    .from(tokenLedger)
    .where(and(eq(tokenLedger.userId, userId), inArray(tokenLedger.groupId, groupIds)))
    .groupBy(tokenLedger.groupId);

  const actualByGroup = new Map<string, number>(
    balanceRows.map((r) => [r.groupId, Number(r.balance)]),
  );

  // Query 2: already-distributed matchIds per group
  const distributionRows = await db
    .select({ groupId: tokenLedger.groupId, matchId: tokenLedger.referenceId })
    .from(tokenLedger)
    .where(
      and(
        eq(tokenLedger.userId, userId),
        inArray(tokenLedger.groupId, groupIds),
        eq(tokenLedger.type, "distribution"),
      ),
    );

  const distributedByGroup = new Map<string, Set<string>>();
  for (const r of distributionRows) {
    if (!r.matchId) continue;
    if (!distributedByGroup.has(r.groupId)) distributedByGroup.set(r.groupId, new Set());
    const groupSet = distributedByGroup.get(r.groupId);
    if (groupSet) groupSet.add(r.matchId);
  }

  // Query 3: bet/refund ledger entries with match references (for future-day correction)
  const betRefundRows = await db
    .select({
      groupId: tokenLedger.groupId,
      amount: tokenLedger.amount,
      matchId: bets.matchId,
    })
    .from(tokenLedger)
    .innerJoin(bets, eq(tokenLedger.referenceId, bets.id))
    .where(
      and(
        eq(tokenLedger.userId, userId),
        inArray(tokenLedger.groupId, groupIds),
        inArray(tokenLedger.type, ["bet", "refund"]),
      ),
    );

  // In-memory computation — same logic as getProjectedBalance but for all pairs.
  // DATE comparison uses UTC (consistent with PostgreSQL default timezone)
  const toDateNum = (d: Date) =>
    d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();

  const scheduledMatches = allMatches.filter((m) => m.status === "scheduled");
  const matchDateMap = new Map(allMatches.map((m) => [m.id, toDateNum(m.scheduledAt)]));

  // Index betRefundRows by groupId for efficient lookup
  const betRefundByGroup = new Map<string, Array<{ amount: number; dateNum: number }>>();
  for (const r of betRefundRows) {
    const dateNum = matchDateMap.get(r.matchId);
    if (dateNum === undefined) continue;
    const existing = betRefundByGroup.get(r.groupId);
    if (existing) {
      existing.push({ amount: Number(r.amount), dateNum });
    } else {
      betRefundByGroup.set(r.groupId, [{ amount: Number(r.amount), dateNum }]);
    }
  }

  const result: Record<
    string,
    Record<string, { projected: number; actual: number; pending: number; tokenPerMatch: number }>
  > = {};

  for (const match of allMatches) {
    result[match.id] = {};
    const matchDateNum = toDateNum(match.scheduledAt);

    for (const group of groupsData) {
      const actual = actualByGroup.get(group.id) ?? 0;
      const distributed = distributedByGroup.get(group.id) ?? new Set<string>();

      const pending = scheduledMatches.filter(
        (m) => toDateNum(m.scheduledAt) <= matchDateNum && !distributed.has(m.id),
      ).length;

      // Correction: undo effect of bets/refunds on matches AFTER this day
      const groupBetRefunds = betRefundByGroup.get(group.id) ?? [];
      const futureBetsNet = groupBetRefunds
        .filter((r) => r.dateNum > matchDateNum)
        .reduce((sum, r) => sum + r.amount, 0);

      // Day-scoped actual: exclude the effect of future-day bets
      const dayActual = actual - futureBetsNet;

      result[match.id][group.id] = {
        projected: dayActual + pending * group.tokenPerMatch,
        actual: dayActual,
        pending,
        tokenPerMatch: group.tokenPerMatch,
      };
    }
  }

  return result;
}

export async function getPublicGroups(userId: string) {
  const userGroupIds = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));

  const excludeIds = userGroupIds.map((r) => r.groupId);

  return db.query.groups.findMany({
    where: and(
      eq(groups.isPublic, true),
      excludeIds.length > 0 ? notInArray(groups.id, excludeIds) : undefined,
    ),
    with: {
      tournament: true,
      owner: true,
      members: true,
    },
  });
}
