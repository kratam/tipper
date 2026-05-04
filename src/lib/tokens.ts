import { and, eq, sql } from "drizzle-orm";
import { tokenLedger } from "@/db/schema";
import { get1X2 } from "./scoring";

interface ProjectedBalanceInput {
  actualBalance: number;
  pendingDistributions: number;
  tokenPerMatch: number;
}

export function calculateProjectedBalance(input: ProjectedBalanceInput): number {
  return input.actualBalance + input.pendingDistributions * input.tokenPerMatch;
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
 * Give a user their initial tokens + catch-up tokens for all matches
 * that have already been distributed in this group.
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

  // 2. Catch-up: find all matches that have been distributed to ANY member in this group
  const distributedMatchIds = await db
    .selectDistinct({ matchId: tokenLedger.referenceId })
    .from(tokenLedger)
    .where(
      and(
        eq(tokenLedger.groupId, groupId),
        eq(tokenLedger.type, "distribution"),
        sql`${tokenLedger.referenceId} IS NOT NULL`,
      ),
    );

  for (const { matchId } of distributedMatchIds) {
    if (!matchId) continue;

    const existing = await db
      .select({ count: sql<number>`count(*)` })
      .from(tokenLedger)
      .where(
        and(
          eq(tokenLedger.userId, userId),
          eq(tokenLedger.groupId, groupId),
          eq(tokenLedger.type, "distribution"),
          eq(tokenLedger.referenceId, matchId),
        ),
      );

    if (Number(existing[0].count) > 0) continue;

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
