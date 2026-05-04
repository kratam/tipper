import "server-only";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { bets, groupMembers, groups, matches, tokenLedger, tournaments } from "@/db/schema";
import { computeProjectedFromCumulativeBudget, dateToDateNum } from "@/lib/tokens";

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

export async function getGroupBySlug(tournamentSlug: string, groupSlug: string) {
  const tournament = await db.query.tournaments.findFirst({
    where: eq(tournaments.slug, tournamentSlug),
  });
  if (!tournament) return undefined;

  return db.query.groups.findFirst({
    where: and(eq(groups.tournamentId, tournament.id), eq(groups.slug, groupSlug)),
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
 * Calculate projected balance — i.e. the maximum new stake the user may place
 * on the target match.
 *
 * Model: a user's lifetime budget at any point in time is
 *   initialTokens + tokenPerMatch × (matches whose date has arrived).
 * Active bets reduce that budget. A bet on a future match implicitly borrows
 * against tokens that haven't been distributed yet, so the constraint is:
 *
 *   for every cutoff date D' ≥ targetDay:
 *     sum(stakes for active bets on matches with date ≤ D')
 *       ≤ initialTokens + tokenPerMatch × (matches with date ≤ D')
 *
 * The projected balance is the smallest slack across all such D'. This
 * prevents a user from placing a future-day bet that exceeds the cumulative
 * budget available by that day, while still allowing them to "earmark"
 * upcoming distributions for a future-day stake.
 *
 * actual / pending in the return value preserve the legacy meaning used by
 * the bet-form tooltip:
 *   actual  = real ledger sum minus the effect of bets on matches after the
 *             target day (so the tooltip shows what's "really there" today).
 *   pending = count of matches on or before the target day that haven't
 *             been distributed yet.
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

  // Fetch every non-cancelled match in the tournament (date + id only).
  const tournamentMatches = await db
    .select({ id: matches.id, scheduledAt: matches.scheduledAt })
    .from(matches)
    .where(
      and(eq(matches.tournamentId, group.tournamentId), sql`${matches.status} <> 'cancelled'`),
    );

  // Active-bet stakes joined to their match dates.
  const activeBetRows = await db
    .select({ stake: bets.stake, scheduledAt: matches.scheduledAt })
    .from(bets)
    .innerJoin(matches, eq(bets.matchId, matches.id))
    .where(and(eq(bets.userId, userId), eq(bets.groupId, groupId)));

  // Already-distributed matchIds for this user (drives the tooltip's pending count).
  const distributionRows = await db
    .select({ matchId: tokenLedger.referenceId })
    .from(tokenLedger)
    .where(
      and(
        eq(tokenLedger.userId, userId),
        eq(tokenLedger.groupId, groupId),
        eq(tokenLedger.type, "distribution"),
        sql`${tokenLedger.referenceId} IS NOT NULL`,
      ),
    );
  const distributedSet = new Set(distributionRows.map((r) => r.matchId).filter((x) => x !== null));

  const targetDateNum = dateToDateNum(targetMatch.scheduledAt);
  const projected = computeProjectedFromCumulativeBudget({
    initialTokens: group.initialTokens,
    tokenPerMatch: group.tokenPerMatch,
    targetDateNum,
    matchDates: tournamentMatches.map((m) => dateToDateNum(m.scheduledAt)),
    activeBets: activeBetRows.map((b) => ({
      stake: b.stake,
      dateNum: dateToDateNum(b.scheduledAt),
    })),
  });

  // Tooltip values (legacy semantics)
  const actual = await getTokenBalance(userId, groupId);
  const futureBetsNet = activeBetRows
    .filter((b) => dateToDateNum(b.scheduledAt) > targetDateNum)
    .reduce((sum, b) => sum - b.stake, 0); // bets are negative ledger entries
  const tooltipActual = actual - futureBetsNet;
  const pending = tournamentMatches.filter(
    (m) => dateToDateNum(m.scheduledAt) <= targetDateNum && !distributedSet.has(m.id),
  ).length;

  return {
    projected,
    actual: tooltipActual,
    pending,
    tokenPerMatch: group.tokenPerMatch,
  };
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
 * Batch-compute projected balances for all (group, match) pairs.
 * Returns result[matchId][groupId] = { projected, actual, pending, tokenPerMatch }.
 *
 * See getProjectedBalance for the underlying budget model. This batch variant
 * fetches all data in 3 queries and does the per-pair work in memory.
 */
export async function getBatchProjectedBalances(
  userId: string,
  groupsData: Array<{ id: string; initialTokens: number; tokenPerMatch: number }>,
  allMatches: Array<{ id: string; scheduledAt: Date; status: string }>,
): Promise<
  Record<
    string,
    Record<string, { projected: number; actual: number; pending: number; tokenPerMatch: number }>
  >
> {
  if (groupsData.length === 0 || allMatches.length === 0) return {};

  const groupIds = groupsData.map((g) => g.id);

  // Query 1: actual ledger sum per group
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

  // Query 2: already-distributed matchIds per group (drives tooltip pending count)
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
    distributedByGroup.get(r.groupId)?.add(r.matchId);
  }

  // Query 3: active bets joined with their match dates per group
  const activeBetRows = await db
    .select({
      groupId: bets.groupId,
      stake: bets.stake,
      matchId: bets.matchId,
      scheduledAt: matches.scheduledAt,
    })
    .from(bets)
    .innerJoin(matches, eq(bets.matchId, matches.id))
    .where(and(eq(bets.userId, userId), inArray(bets.groupId, groupIds)));

  // Eligible matches for budget (non-cancelled tournament matches we're computing for)
  const budgetMatches = allMatches.filter((m) => m.status !== "cancelled");
  const matchDates = budgetMatches.map((m) => dateToDateNum(m.scheduledAt));

  // Index active bets by group
  const activeBetsByGroup = new Map<string, Array<{ stake: number; dateNum: number }>>();
  for (const r of activeBetRows) {
    const entry = { stake: r.stake, dateNum: dateToDateNum(r.scheduledAt) };
    const existing = activeBetsByGroup.get(r.groupId);
    if (existing) existing.push(entry);
    else activeBetsByGroup.set(r.groupId, [entry]);
  }

  const result: Record<
    string,
    Record<string, { projected: number; actual: number; pending: number; tokenPerMatch: number }>
  > = {};

  for (const match of allMatches) {
    result[match.id] = {};
    const targetDateNum = dateToDateNum(match.scheduledAt);

    for (const group of groupsData) {
      const actual = actualByGroup.get(group.id) ?? 0;
      const distributed = distributedByGroup.get(group.id) ?? new Set<string>();
      const activeBets = activeBetsByGroup.get(group.id) ?? [];

      const projected = computeProjectedFromCumulativeBudget({
        initialTokens: group.initialTokens,
        tokenPerMatch: group.tokenPerMatch,
        targetDateNum,
        matchDates,
        activeBets,
      });

      const futureBetsNet = activeBets
        .filter((b) => b.dateNum > targetDateNum)
        .reduce((sum, b) => sum - b.stake, 0); // bets are negative ledger entries
      const tooltipActual = actual - futureBetsNet;

      const pending = budgetMatches.filter(
        (m) => dateToDateNum(m.scheduledAt) <= targetDateNum && !distributed.has(m.id),
      ).length;

      result[match.id][group.id] = {
        projected,
        actual: tooltipActual,
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
      eq(groups.isOfficial, false),
      excludeIds.length > 0 ? notInArray(groups.id, excludeIds) : undefined,
    ),
    with: {
      tournament: true,
      owner: true,
      members: true,
    },
  });
}

export interface PublicGroupSuggestion {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  memberCount: number;
  tokenPerMatch: number;
  initialTokens: number;
  bonusGoalDiff: number;
  bonusExactScore: number;
  bonusPodiumMention: number;
  oddsBoost: number;
  tournament: {
    name: string;
    slug: string;
    status: string;
  };
}

export async function getTopPublicGroupsForTournament(
  userId: string,
  tournamentId: string,
  limit: number,
): Promise<PublicGroupSuggestion[]> {
  const userGroupIds = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));

  const excludeIds = userGroupIds.map((r) => r.groupId);

  const rows = await db.query.groups.findMany({
    where: and(
      eq(groups.isPublic, true),
      eq(groups.isOfficial, false),
      eq(groups.tournamentId, tournamentId),
      excludeIds.length > 0 ? notInArray(groups.id, excludeIds) : undefined,
    ),
    with: {
      tournament: true,
      members: true,
    },
  });

  return rows
    .sort((a, b) => b.members.length - a.members.length)
    .slice(0, limit)
    .map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      description: g.description,
      memberCount: g.members.length,
      tokenPerMatch: g.tokenPerMatch,
      initialTokens: g.initialTokens,
      bonusGoalDiff: g.bonusGoalDiff,
      bonusExactScore: g.bonusExactScore,
      bonusPodiumMention: g.bonusPodiumMention,
      oddsBoost: g.oddsBoost,
      tournament: {
        name: g.tournament.name,
        slug: g.tournament.slug,
        status: g.tournament.status,
      },
    }));
}
