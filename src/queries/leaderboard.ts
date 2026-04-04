import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { groupMembers, tokenLedger, users } from "@/db/schema";

export async function getGroupLeaderboard(groupId: string) {
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
    .where(eq(groupMembers.groupId, groupId))
    .groupBy(groupMembers.userId, users.id, users.name, users.displayName, users.avatarUrl)
    .orderBy(desc(sql`COALESCE(SUM(${tokenLedger.amount}), 0)`));

  return rows.map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
}
