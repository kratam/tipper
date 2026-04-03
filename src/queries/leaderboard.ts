import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { groupMembers, tokenLedger, users } from "@/db/schema";

export async function getGroupLeaderboard(groupId: string) {
  const rows = await db
    .select({
      userId: groupMembers.userId,
      userName: users.name,
      userAvatarUrl: users.avatarUrl,
      balance: sql<number>`COALESCE(SUM(${tokenLedger.amount}), 0)`,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .leftJoin(
      tokenLedger,
      and(eq(tokenLedger.userId, groupMembers.userId), eq(tokenLedger.groupId, groupId)),
    )
    .where(eq(groupMembers.groupId, groupId))
    .groupBy(groupMembers.userId, users.id, users.name, users.avatarUrl)
    .orderBy(desc(sql`COALESCE(SUM(${tokenLedger.amount}), 0)`));

  return rows.map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
}
