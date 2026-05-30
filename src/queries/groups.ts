import "server-only";
import { and, eq, inArray, isNotNull, isNull, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { bets, groupMembers, groups, matches, tokenLedger, tournaments } from "@/db/schema";
import {
  computeProjectedFromCumulativeBudget,
  dateToDateNum,
  splitResolvedNets,
} from "@/lib/tokens";

export async function getUserGroups(userId: string) {
  // Member rows are NOT loaded here — callers that need a head count use
  // getMemberCountsByGroup, which fetches counts in a single aggregate instead
  // of shipping every membership row for every group.
  return db.query.groupMembers.findMany({
    where: eq(groupMembers.userId, userId),
    with: {
      group: {
        with: {
          tournament: true,
          owner: true,
        },
      },
    },
  });
}

/**
 * Head count per group in one aggregate query. Returns a Map keyed by groupId;
 * groups with no members are absent (treat as 0).
 */
export async function getMemberCountsByGroup(groupIds: string[]): Promise<Map<string, number>> {
  if (groupIds.length === 0) return new Map();
  const rows = await db
    .select({ groupId: groupMembers.groupId, count: sql<number>`count(*)` })
    .from(groupMembers)
    .where(inArray(groupMembers.groupId, groupIds))
    .groupBy(groupMembers.groupId);
  return new Map(rows.map((r) => [r.groupId, Number(r.count)]));
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
 * Lifetime budget at any cutoff date D' is
 *   initialTokens
 *   + tokenPerMatch × (matches whose date ≤ D')
 *   + Σ (payout - stake) for resolved bets on matches with date ≤ D'
 * UNRESOLVED active bets reduce the slack at every cutoff ≥ their date. So
 * the constraint is:
 *
 *   for every cutoff date D' ≥ targetDay:
 *     sum(stakes for ACTIVE bets on matches with date ≤ D')
 *       ≤ lifetime budget at D'
 *
 * The projected balance is the smallest slack across all such D'. This lets
 * users re-bet won-back stakes plus net winnings (incl. bonusGoalDiff /
 * bonusExactScore, since both are baked into bets.payout by scoring) while
 * still preventing future-day bets that would exceed the cumulative budget.
 * See [[../lib/tokens.ts#computeProjectedFromCumulativeBudget]].
 *
 * actual / pending in the return value preserve the legacy meaning used by
 * the bet-form tooltip:
 *   actual  = real ledger sum minus the effect of bets on matches after the
 *             target day. Since `actual` is SUM(token_ledger.amount), it
 *             already includes any resolved wins.
 *   pending = count of matches on or before the target day that haven't
 *             been distributed yet.
 */
export interface ProjectedBalanceResult {
  projected: number;
  actual: number;
  pending: number;
  tokenPerMatch: number;
  // Breakdown used by the bet-form tooltip. Reconciles to the displayed
  // effective balance via:
  //   init + eligibleMatchCount × tokenPerMatch + winnings + losses - otherActiveStakes
  //     = projected + existingBetStake (effective balance)
  // when the target day is the binding constraint (the common case).
  initialTokens: number;
  eligibleMatchCount: number;
  winnings: number;
  losses: number;
  otherActiveStakes: number;
}

const EMPTY_BREAKDOWN = {
  initialTokens: 0,
  eligibleMatchCount: 0,
  winnings: 0,
  losses: 0,
  otherActiveStakes: 0,
} as const;

export async function getProjectedBalance(
  userId: string,
  groupId: string,
  matchId: string,
): Promise<ProjectedBalanceResult> {
  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
  });
  if (!group) return { projected: 0, actual: 0, pending: 0, tokenPerMatch: 0, ...EMPTY_BREAKDOWN };

  // Everything below depends only on `group` + the input ids, not on each
  // other — fetch in one Promise.all instead of chaining round trips (neon-http
  // = one HTTP request per query). The batch variant getBatchProjectedBalances
  // already fetches in parallel; this brings the single-pair path in line.
  //
  // - tournament: timezone — betting days are bucketed in the tournament's
  //   timezone (NOT UTC), so a 01:00 local kickoff counts as its local day.
  // - tournamentMatches: every non-cancelled match in the tournament (date+id).
  // - activeBetRows: unresolved (payout IS NULL) bets on non-cancelled matches —
  //   still lock up their stake. Cancelled-match bets are excluded (already
  //   refunded, net 0, and not in the budget).
  // - resolvedBetRows: scoring done (payout IS NOT NULL). Net `payout - stake`
  //   raises/lowers the lifetime cap.
  // - distributionRows: already-distributed matchIds (drives tooltip pending).
  // - actual: full ledger SUM (already reflects resolved wins/losses).
  const [
    tournament,
    targetMatch,
    tournamentMatches,
    activeBetRows,
    resolvedBetRows,
    distributionRows,
    actual,
  ] = await Promise.all([
    db.query.tournaments.findFirst({
      where: eq(tournaments.id, group.tournamentId),
      columns: { timezone: true },
    }),
    db.query.matches.findFirst({ where: eq(matches.id, matchId) }),
    db
      .select({ id: matches.id, scheduledAt: matches.scheduledAt })
      .from(matches)
      .where(
        and(eq(matches.tournamentId, group.tournamentId), sql`${matches.status} <> 'cancelled'`),
      ),
    db
      .select({ stake: bets.stake, matchId: bets.matchId, scheduledAt: matches.scheduledAt })
      .from(bets)
      .innerJoin(matches, eq(bets.matchId, matches.id))
      .where(
        and(
          eq(bets.userId, userId),
          eq(bets.groupId, groupId),
          isNull(bets.payout),
          sql`${matches.status} <> 'cancelled'`,
        ),
      ),
    db
      .select({ stake: bets.stake, payout: bets.payout, scheduledAt: matches.scheduledAt })
      .from(bets)
      .innerJoin(matches, eq(bets.matchId, matches.id))
      .where(and(eq(bets.userId, userId), eq(bets.groupId, groupId), isNotNull(bets.payout))),
    db
      .select({ matchId: tokenLedger.referenceId })
      .from(tokenLedger)
      .where(
        and(
          eq(tokenLedger.userId, userId),
          eq(tokenLedger.groupId, groupId),
          eq(tokenLedger.type, "distribution"),
          sql`${tokenLedger.referenceId} IS NOT NULL`,
        ),
      ),
    getTokenBalance(userId, groupId),
  ]);

  const timeZone = tournament?.timezone ?? "UTC";

  if (!targetMatch)
    return {
      projected: 0,
      actual: 0,
      pending: 0,
      tokenPerMatch: group.tokenPerMatch,
      ...EMPTY_BREAKDOWN,
      initialTokens: group.initialTokens,
    };

  const distributedSet = new Set(distributionRows.map((r) => r.matchId).filter((x) => x !== null));

  const targetDateNum = dateToDateNum(targetMatch.scheduledAt, timeZone);
  const resolvedBetNets = resolvedBetRows.map((b) => ({
    netPayout: (b.payout ?? 0) - b.stake,
    dateNum: dateToDateNum(b.scheduledAt, timeZone),
  }));
  const projected = computeProjectedFromCumulativeBudget({
    initialTokens: group.initialTokens,
    tokenPerMatch: group.tokenPerMatch,
    targetDateNum,
    matchDates: tournamentMatches.map((m) => dateToDateNum(m.scheduledAt, timeZone)),
    activeBets: activeBetRows.map((b) => ({
      stake: b.stake,
      dateNum: dateToDateNum(b.scheduledAt, timeZone),
    })),
    resolvedBetNets,
  });

  // Tooltip values (legacy semantics). `actual` (fetched above) is the full
  // ledger SUM, which already reflects resolved wins/losses — so the tooltip
  // stays correct without changes. We still subtract future active-bet stakes
  // so the "actual balance" line shows what's really available today.
  const futureBetsNet = activeBetRows
    .filter((b) => dateToDateNum(b.scheduledAt, timeZone) > targetDateNum)
    .reduce((sum, b) => sum - b.stake, 0); // bets are negative ledger entries
  const tooltipActual = actual - futureBetsNet;
  const pending = tournamentMatches.filter(
    (m) => dateToDateNum(m.scheduledAt, timeZone) <= targetDateNum && !distributedSet.has(m.id),
  ).length;

  // Breakdown for the bet-form tooltip. All values are computed at the target
  // day cutoff so they reconcile to the displayed effective balance.
  const eligibleMatchCount = tournamentMatches.filter(
    (m) => dateToDateNum(m.scheduledAt, timeZone) <= targetDateNum,
  ).length;
  const { winnings, losses } = splitResolvedNets(resolvedBetNets, targetDateNum);
  const otherActiveStakes = activeBetRows
    .filter((b) => dateToDateNum(b.scheduledAt, timeZone) <= targetDateNum && b.matchId !== matchId)
    .reduce((sum, b) => sum + b.stake, 0);

  return {
    projected,
    actual: tooltipActual,
    pending,
    tokenPerMatch: group.tokenPerMatch,
    initialTokens: group.initialTokens,
    eligibleMatchCount,
    winnings,
    losses,
    otherActiveStakes,
  };
}

/**
 * Profit from resolved matches: sum of bet/win/refund ledger entries
 * where the linked match is finished or cancelled.
 * Win: -stake + payout = net gain. Loss: -stake + partialRefund (10% of stake
 * under the default 90% rule; 0 only when lossPercentage=100). Cancelled:
 * -stake + stake = 0.
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
 * Batch variant of getUserProfit: one grouped aggregate for many groups instead
 * of a query per group. Returns a Map keyed by groupId; groups with no matching
 * ledger rows are absent (treat as 0).
 */
export async function getUserProfitsByGroup(
  userId: string,
  groupIds: string[],
): Promise<Map<string, number>> {
  if (groupIds.length === 0) return new Map();

  const rows = await db
    .select({
      groupId: tokenLedger.groupId,
      profit: sql<number>`COALESCE(SUM(CASE WHEN ${matches.status} IN ('finished', 'cancelled') THEN ${tokenLedger.amount} ELSE 0 END), 0)`,
    })
    .from(tokenLedger)
    .leftJoin(bets, eq(tokenLedger.referenceId, bets.id))
    .leftJoin(matches, eq(bets.matchId, matches.id))
    .where(
      and(
        eq(tokenLedger.userId, userId),
        inArray(tokenLedger.groupId, groupIds),
        inArray(tokenLedger.type, ["bet", "win", "refund"]),
      ),
    )
    .groupBy(tokenLedger.groupId);

  return new Map(rows.map((r) => [r.groupId, Number(r.profit)]));
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
  timeZone: string,
): Promise<Record<string, Record<string, ProjectedBalanceResult>>> {
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

  // Query 3a: active bets (unresolved, non-cancelled match) joined with dates
  const activeBetRows = await db
    .select({
      groupId: bets.groupId,
      stake: bets.stake,
      matchId: bets.matchId,
      scheduledAt: matches.scheduledAt,
    })
    .from(bets)
    .innerJoin(matches, eq(bets.matchId, matches.id))
    .where(
      and(
        eq(bets.userId, userId),
        inArray(bets.groupId, groupIds),
        isNull(bets.payout),
        sql`${matches.status} <> 'cancelled'`,
      ),
    );

  // Query 3b: resolved bets (scoring done) — their net effect feeds maxBudget
  const resolvedBetRows = await db
    .select({
      groupId: bets.groupId,
      stake: bets.stake,
      payout: bets.payout,
      scheduledAt: matches.scheduledAt,
    })
    .from(bets)
    .innerJoin(matches, eq(bets.matchId, matches.id))
    .where(and(eq(bets.userId, userId), inArray(bets.groupId, groupIds), isNotNull(bets.payout)));

  // Eligible matches for budget (non-cancelled tournament matches we're computing for).
  // Precompute each match's dateNum ONCE here: the inner pending/eligible filters
  // would otherwise recompute it O(matches × groups) times, and each dateToDateNum
  // call used to build a fresh Intl.DateTimeFormat (see getBatchProjectedBalances'
  // hot path — ~21k formatter constructions for a 104-match tournament).
  const budgetMatchInfos = allMatches
    .filter((m) => m.status !== "cancelled")
    .map((m) => ({ id: m.id, dateNum: dateToDateNum(m.scheduledAt, timeZone) }));
  const matchDates = budgetMatchInfos.map((m) => m.dateNum);

  // Index active bets by group (matchId kept so we can exclude the target
  // match's bet when computing the breakdown's otherActiveStakes).
  const activeBetsByGroup = new Map<
    string,
    Array<{ stake: number; matchId: string; dateNum: number }>
  >();
  for (const r of activeBetRows) {
    const entry = {
      stake: r.stake,
      matchId: r.matchId,
      dateNum: dateToDateNum(r.scheduledAt, timeZone),
    };
    const existing = activeBetsByGroup.get(r.groupId);
    if (existing) existing.push(entry);
    else activeBetsByGroup.set(r.groupId, [entry]);
  }

  // Index resolved bets by group with both net and stake. Net feeds maxBudget
  // and the tooltip's winnings/losses split.
  const resolvedBetsByGroup = new Map<
    string,
    Array<{ stake: number; payout: number; dateNum: number }>
  >();
  for (const r of resolvedBetRows) {
    const entry = {
      stake: r.stake,
      payout: r.payout ?? 0,
      dateNum: dateToDateNum(r.scheduledAt, timeZone),
    };
    const existing = resolvedBetsByGroup.get(r.groupId);
    if (existing) existing.push(entry);
    else resolvedBetsByGroup.set(r.groupId, [entry]);
  }

  const result: Record<string, Record<string, ProjectedBalanceResult>> = {};

  for (const match of allMatches) {
    result[match.id] = {};
    const targetDateNum = dateToDateNum(match.scheduledAt, timeZone);

    // Group-independent: matches whose betting day is on or before the target.
    const eligibleMatchCount = budgetMatchInfos.filter((m) => m.dateNum <= targetDateNum).length;

    for (const group of groupsData) {
      const actual = actualByGroup.get(group.id) ?? 0;
      const distributed = distributedByGroup.get(group.id) ?? new Set<string>();
      const activeBets = activeBetsByGroup.get(group.id) ?? [];
      const resolvedBets = resolvedBetsByGroup.get(group.id) ?? [];
      const resolvedBetNets = resolvedBets.map((b) => ({
        netPayout: b.payout - b.stake,
        dateNum: b.dateNum,
      }));

      const projected = computeProjectedFromCumulativeBudget({
        initialTokens: group.initialTokens,
        tokenPerMatch: group.tokenPerMatch,
        targetDateNum,
        matchDates,
        activeBets,
        resolvedBetNets,
      });

      const futureBetsNet = activeBets
        .filter((b) => b.dateNum > targetDateNum)
        .reduce((sum, b) => sum - b.stake, 0); // bets are negative ledger entries
      const tooltipActual = actual - futureBetsNet;

      const pending = budgetMatchInfos.filter(
        (m) => m.dateNum <= targetDateNum && !distributed.has(m.id),
      ).length;

      let winnings = 0;
      let losses = 0;
      for (const r of resolvedBets) {
        if (r.dateNum > targetDateNum) continue;
        const net = r.payout - r.stake;
        if (net > 0) winnings += net;
        else if (net < 0) losses += net;
      }
      const otherActiveStakes = activeBets
        .filter((b) => b.dateNum <= targetDateNum && b.matchId !== match.id)
        .reduce((sum, b) => sum + b.stake, 0);

      result[match.id][group.id] = {
        projected,
        actual: tooltipActual,
        pending,
        tokenPerMatch: group.tokenPerMatch,
        initialTokens: group.initialTokens,
        eligibleMatchCount,
        winnings,
        losses,
        otherActiveStakes,
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

  const nonArchivedTournamentIds = (
    await db
      .select({ id: tournaments.id })
      .from(tournaments)
      .where(eq(tournaments.isArchived, false))
  ).map((r) => r.id);

  if (nonArchivedTournamentIds.length === 0) return [];

  const rows = await db.query.groups.findMany({
    where: and(
      eq(groups.isPublic, true),
      eq(groups.isOfficial, false),
      inArray(groups.tournamentId, nonArchivedTournamentIds),
      excludeIds.length > 0 ? notInArray(groups.id, excludeIds) : undefined,
    ),
    with: {
      tournament: true,
      owner: true,
    },
  });

  const counts = await getMemberCountsByGroup(rows.map((r) => r.id));
  return rows.map((g) => ({ ...g, memberCount: counts.get(g.id) ?? 0 }));
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
  lossPercentage: number;
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
  const tournament = await db.query.tournaments.findFirst({
    where: eq(tournaments.id, tournamentId),
    columns: { isArchived: true },
  });
  if (tournament?.isArchived) return [];

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
    },
  });

  const counts = await getMemberCountsByGroup(rows.map((r) => r.id));

  return rows
    .map((g) => ({ group: g, memberCount: counts.get(g.id) ?? 0 }))
    .sort((a, b) => b.memberCount - a.memberCount)
    .slice(0, limit)
    .map(({ group: g, memberCount }) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      description: g.description,
      memberCount,
      tokenPerMatch: g.tokenPerMatch,
      initialTokens: g.initialTokens,
      bonusGoalDiff: g.bonusGoalDiff,
      bonusExactScore: g.bonusExactScore,
      bonusPodiumMention: g.bonusPodiumMention,
      oddsBoost: g.oddsBoost,
      lossPercentage: g.lossPercentage,
      tournament: {
        name: g.tournament.name,
        slug: g.tournament.slug,
        status: g.tournament.status,
      },
    }));
}
