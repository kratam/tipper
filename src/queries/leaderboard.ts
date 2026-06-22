import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { bets, groupMembers, matches, tokenLedger, users } from "@/db/schema";

export async function getGroupLeaderboard(groupId: string) {
  // All group members appear; profit only counts resolved matches.
  // Conditional aggregation: pending bets contribute 0, not excluded.
  const rows = await db
    .select({
      userId: groupMembers.userId,
      userName: sql<string>`COALESCE(${users.displayName}, ${users.name})`.as("user_name"),
      userAvatarUrl: users.avatarUrl,
      profit: sql<number>`COALESCE(SUM(CASE WHEN ${matches.status} IN ('finished', 'cancelled') THEN ${tokenLedger.amount} ELSE 0 END), 0)`,
      betCount: sql<number>`COUNT(DISTINCT ${bets.id})::int`,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .leftJoin(
      tokenLedger,
      and(
        eq(tokenLedger.userId, groupMembers.userId),
        eq(tokenLedger.groupId, groupId),
        inArray(tokenLedger.type, ["bet", "win", "refund"]),
      ),
    )
    .leftJoin(bets, eq(tokenLedger.referenceId, bets.id))
    .leftJoin(matches, eq(bets.matchId, matches.id))
    .where(eq(groupMembers.groupId, groupId))
    .groupBy(groupMembers.userId, users.id, users.name, users.displayName, users.avatarUrl)
    .orderBy(
      desc(
        sql`COALESCE(SUM(CASE WHEN ${matches.status} IN ('finished', 'cancelled') THEN ${tokenLedger.amount} ELSE 0 END), 0)`,
      ),
    );

  return rows.map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
}
