import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { bets, groupMembers, matches, tokenLedger, users } from "@/db/schema";

export async function getGroupLeaderboard(groupId: string) {
  // Only count profit from resolved matches (finished/cancelled).
  // Join: tokenLedger → bets (via referenceId) → matches (via matchId)
  // Pending bets (match not yet resolved) are excluded.
  // User-cancelled bets (deleted bet row) also drop out, but those are
  // always a bet+refund pair netting to 0, so the result stays correct.
  const rows = await db
    .select({
      userId: groupMembers.userId,
      userName: sql<string>`COALESCE(${users.displayName}, ${users.name})`.as("user_name"),
      userAvatarUrl: users.avatarUrl,
      profit: sql<number>`COALESCE(SUM(${tokenLedger.amount}), 0)`,
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
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        sql`(${tokenLedger.id} IS NULL OR ${matches.status} IN ('finished', 'cancelled'))`,
      ),
    )
    .groupBy(groupMembers.userId, users.id, users.name, users.displayName, users.avatarUrl)
    .orderBy(desc(sql`COALESCE(SUM(${tokenLedger.amount}), 0)`));

  return rows.map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
}
