import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bets, matches } from "@/db/schema";

/**
 * A klasszikus (token nélküli) összpont userenként egy csoportban: a `finished`
 * meccsű, lepontozott tippek találat-flagjeinek összege
 * (kimenet + gólkülönbség + pontos eredmény → 0..3 per tipp). Séma-változás
 * nélkül, közvetlenül a `bets` flagekből.
 */
export async function getGroupClassicPoints(groupId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({
      userId: bets.userId,
      points: sql<number>`COALESCE(SUM(
        (CASE WHEN ${bets.result1x2Correct} THEN 1 ELSE 0 END)
        + (CASE WHEN ${bets.goalDiffCorrect} THEN 1 ELSE 0 END)
        + (CASE WHEN ${bets.exactScoreCorrect} THEN 1 ELSE 0 END)
      ), 0)::int`,
    })
    .from(bets)
    .innerJoin(matches, eq(bets.matchId, matches.id))
    .where(and(eq(bets.groupId, groupId), eq(matches.status, "finished")))
    .groupBy(bets.userId);

  return new Map(rows.map((r) => [r.userId, r.points]));
}
