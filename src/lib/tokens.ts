import { and, eq, sql } from "drizzle-orm";
import { matches, tokenLedger } from "@/db/schema";
import { get1X2 } from "./scoring";

interface ProjectedBalanceInput {
  actualBalance: number;
  pendingDistributions: number;
  tokenPerMatch: number;
}

export function calculateProjectedBalance(input: ProjectedBalanceInput): number {
  return input.actualBalance + input.pendingDistributions * input.tokenPerMatch;
}

export interface CumulativeBudgetInput {
  initialTokens: number;
  tokenPerMatch: number;
  /** Target match's date as a comparable number (YYYYMMDD). */
  targetDateNum: number;
  /** Date numbers (YYYYMMDD) of every non-cancelled tournament match. */
  matchDates: number[];
  /**
   * Stakes for bets that are still UNRESOLVED (match.status='scheduled', or
   * 'finished' but scoring hasn't run yet — i.e. bets.payout IS NULL on a
   * non-cancelled match). Each bet's stake reduces the slack at every cutoff
   * D' ≥ bet.dateNum.
   */
  activeBets: { stake: number; dateNum: number }[];
  /**
   * Net ledger effect of RESOLVED bets (wins, losses, refunds). Defined as
   * `payout - stake` for finished bets and 0 for cancelled bets (refund
   * exactly offsets the stake). Each resolved bet's net contributes to the
   * lifetime budget at every cutoff D' ≥ bet.dateNum — wins raise the cap,
   * losses lower it.
   */
  resolvedBetNets?: ResolvedBetNet[];
}

export interface ResolvedBetNet {
  /** `bets.payout - bets.stake`. Already reflects the group's lossPercentage. */
  netPayout: number;
  /** The bet's match date as a comparable number (YYYYMMDD). */
  dateNum: number;
}

/**
 * Maximum new stake the user may place on the target match.
 *
 * For every cutoff D' ≥ targetDate, we require:
 *   sum(active stakes where bet.dateNum ≤ D')
 *     ≤ initialTokens
 *       + tokenPerMatch × |{ matches with date ≤ D' }|
 *       + sum(netPayout for resolved bets where bet.dateNum ≤ D')
 * The slack at the most-constrained D' is the projected budget.
 *
 * Resolved bets (wins/losses/refunds) are baked into the lifetime cap because
 * a resolved bet's stake is no longer "locked" — its outcome has been written
 * to the ledger, freeing the stake (and adding any winnings or bonuses) for
 * reuse on future matches. Cancelled bets have netPayout=0 (refund nets out
 * the stake) and produce no distribution row, so they don't affect the cap.
 *
 * Bets that already exist on the target match should NOT be passed in if you
 * want the "new bet" view; pass them in if you're computing the post-bet
 * state.
 */
export function computeProjectedFromCumulativeBudget(input: CumulativeBudgetInput): number {
  const {
    initialTokens,
    tokenPerMatch,
    targetDateNum,
    matchDates,
    activeBets,
    resolvedBetNets = [],
  } = input;

  const constraintDateSet = new Set<number>([targetDateNum]);
  for (const d of matchDates) {
    if (d >= targetDateNum) constraintDateSet.add(d);
  }

  let minAvailable = Number.POSITIVE_INFINITY;
  for (const d of constraintDateSet) {
    const matchesByD = matchDates.filter((md) => md <= d).length;
    const resolvedByD = resolvedBetNets
      .filter((r) => r.dateNum <= d)
      .reduce((sum, r) => sum + r.netPayout, 0);
    const maxBudget = initialTokens + matchesByD * tokenPerMatch + resolvedByD;
    const betsThroughD = activeBets
      .filter((b) => b.dateNum <= d)
      .reduce((sum, b) => sum + b.stake, 0);
    const available = maxBudget - betsThroughD;
    if (available < minAvailable) minAvailable = available;
  }

  return minAvailable === Number.POSITIVE_INFINITY ? 0 : minAvailable;
}

/**
 * Encode a match's calendar date as a comparable YYYYMMDD number, evaluated in
 * the tournament's timezone (NOT UTC). The "betting day" that governs token
 * distribution and the cumulative budget must match what users see, so a
 * 01:00 Europe/Budapest kickoff (stored 23:00Z the previous day) counts as the
 * local day, not the UTC day. Uses the same en-CA / timeZone approach as the
 * match-card display so the grouping stays consistent across the app.
 */
export function dateToDateNum(d: Date, timeZone: string): number {
  // en-CA formats as "YYYY-MM-DD", which strips trivially to digits.
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return Number.parseInt(iso.replace(/-/g, ""), 10);
}

/**
 * Split resolved-bet nets into cumulative winnings (positive nets) and losses
 * (negative nets) up to and including the target cutoff date. Mirrors the
 * bet-form "Tippelhető" tooltip breakdown.
 *
 * Each resolved bet's `netPayout = payout - stake` already bakes in the group's
 * lossPercentage: a fully-lost bet under the default 90% rule yields
 * `payout = partialRefund(stake, 90) = 10% of stake`, so its net is `-90% of
 * stake` (NOT `-stake`). The split therefore needs no further interpretation —
 * the 10% refund stays in the budget and is reflected as a smaller loss.
 *
 * `losses` is returned as a non-positive number so the tooltip can sum directly:
 *   initialTokens + matchTokens + winnings + losses - lockedStakes
 */
export function splitResolvedNets(
  resolvedBetNets: ResolvedBetNet[],
  targetDateNum: number,
): { winnings: number; losses: number } {
  let winnings = 0;
  let losses = 0;
  for (const r of resolvedBetNets) {
    if (r.dateNum > targetDateNum) continue;
    if (r.netPayout > 0) winnings += r.netPayout;
    else if (r.netPayout < 0) losses += r.netPayout;
  }
  return { winnings, losses };
}

/**
 * Maximum stake the user may place on the target match.
 *
 * Mirrors bet-form.tsx's `effectiveBalance`: when modifying an existing bet,
 * the old stake is "freed" by the refund, so it must be added back to the
 * projected balance — which (per getProjectedBalance) is computed from
 * `activeBets` that still include the old bet with its old stake.
 *
 * Pass existingBetStake=0 for new bets.
 */
export function getEffectiveBudgetForBet(
  projectedBalance: number,
  existingBetStake: number,
): number {
  return projectedBalance + existingBetStake;
}

export function canAffordBetStake(
  projectedBalance: number,
  existingBetStake: number,
  newStake: number,
): boolean {
  return getEffectiveBudgetForBet(projectedBalance, existingBetStake) >= newStake;
}

export function getRelevantOdds(
  predictedHome: number,
  predictedAway: number,
  odds: { homeOdds: string; drawOdds: string; awayOdds: string },
): number {
  const outcome = get1X2(predictedHome, predictedAway);
  switch (outcome) {
    case "1":
      return Number.parseFloat(odds.homeOdds);
    case "X":
      return Number.parseFloat(odds.drawOdds);
    case "2":
      return Number.parseFloat(odds.awayOdds);
  }
}

/**
 * Give a user their initial tokens + catch-up tokens for every tournament
 * match whose scheduled date is today or earlier. Idempotent — skips
 * entries that already exist for this (user, group).
 */
export async function distributeInitialTokens(
  userId: string,
  groupId: string,
  tournamentId: string,
  initialTokens: number,
  tokenPerMatch: number,
  timeZone: string,
): Promise<void> {
  // Lazy import: top-level `import { db }` would throw at module load
  // when DATABASE_URL is unset (e.g. in vitest), breaking the pure-function
  // tests in this file. Importing inside the function keeps tests green
  // while still letting server callers use the function normally.
  const { db } = await import("@/db");

  // 1. Initial tokens (one-time, referenceId=NULL)
  const existingInitial = await db
    .select({ count: sql<number>`count(*)` })
    .from(tokenLedger)
    .where(
      and(
        eq(tokenLedger.userId, userId),
        eq(tokenLedger.groupId, groupId),
        eq(tokenLedger.type, "distribution"),
        sql`${tokenLedger.referenceId} IS NULL`,
      ),
    );

  if (Number(existingInitial[0].count) === 0) {
    await db.insert(tokenLedger).values({
      userId,
      groupId,
      tournamentId,
      amount: initialTokens,
      type: "distribution",
    });
  }

  // 2. Catch-up: distribute tokenPerMatch for every tournament match whose
  // scheduled date is today or earlier and that doesn't already have a
  // distribution for this user. Cancelled matches are excluded.
  const eligibleMatches = await db
    .select({ id: matches.id })
    .from(matches)
    .where(
      and(
        eq(matches.tournamentId, tournamentId),
        sql`${matches.status} <> 'cancelled'`,
        sql`DATE(${matches.scheduledAt} AT TIME ZONE ${timeZone}) <= DATE(now() AT TIME ZONE ${timeZone})`,
        sql`NOT EXISTS (
          SELECT 1 FROM token_ledger tl
          WHERE tl.user_id = ${userId}
            AND tl.group_id = ${groupId}
            AND tl.type = 'distribution'
            AND tl.reference_id = ${matches.id}
        )`,
      ),
    );

  for (const { id: matchId } of eligibleMatches) {
    await db.insert(tokenLedger).values({
      userId,
      groupId,
      tournamentId,
      amount: tokenPerMatch,
      type: "distribution",
      referenceId: matchId,
    });
  }
}
