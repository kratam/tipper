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
  /** Active bets (the user's existing stakes) joined with each bet's match date. */
  activeBets: { stake: number; dateNum: number }[];
}

/**
 * Maximum new stake the user may place on the target match.
 *
 * For every cutoff D' ≥ targetDate, we require:
 *   sum(stakes where bet.dateNum ≤ D') ≤ initialTokens + tokenPerMatch × |{ matches with date ≤ D' }|
 * The slack at the most-constrained D' is the projected budget. Bets that
 * already exist on the target match should NOT be passed in if you want the
 * "new bet" view; pass them in if you're computing the post-bet state.
 */
export function computeProjectedFromCumulativeBudget(input: CumulativeBudgetInput): number {
  const { initialTokens, tokenPerMatch, targetDateNum, matchDates, activeBets } = input;

  const constraintDateSet = new Set<number>([targetDateNum]);
  for (const d of matchDates) {
    if (d >= targetDateNum) constraintDateSet.add(d);
  }

  let minAvailable = Number.POSITIVE_INFINITY;
  for (const d of constraintDateSet) {
    const matchesByD = matchDates.filter((md) => md <= d).length;
    const maxBudget = initialTokens + matchesByD * tokenPerMatch;
    const betsThroughD = activeBets
      .filter((b) => b.dateNum <= d)
      .reduce((sum, b) => sum + b.stake, 0);
    const available = maxBudget - betsThroughD;
    if (available < minAvailable) minAvailable = available;
  }

  return minAvailable === Number.POSITIVE_INFINITY ? 0 : minAvailable;
}

export function dateToDateNum(d: Date): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
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
        sql`DATE(${matches.scheduledAt}) <= CURRENT_DATE`,
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
