import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { groupMembers, groups, matches, tokenLedger } from "@/db/schema";

export async function getUserGroups(userId: string) {
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

export async function getGroupBySlug(slug: string) {
  return db.query.groups.findFirst({
    where: eq(groups.slug, slug),
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

  return result[0]?.balance ?? 0;
}

/**
 * Calculate projected balance for a user in a group for a specific match.
 * projected = actual_balance + (pending_distributions × tokenPerMatch)
 *
 * pending_distributions = scheduled matches where:
 *   - scheduledAt <= target match scheduledAt
 *   - no distribution ledger entry exists for this (userId, groupId, matchId)
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

  const actual = await getTokenBalance(userId, groupId);

  const pendingResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(matches)
    .where(
      and(
        eq(matches.tournamentId, group.tournamentId),
        eq(matches.status, "scheduled"),
        sql`${matches.scheduledAt} <= ${targetMatch.scheduledAt}`,
        sql`NOT EXISTS (
          SELECT 1 FROM token_ledger tl
          WHERE tl.user_id = ${userId}
            AND tl.group_id = ${groupId}
            AND tl.type = 'distribution'
            AND tl.reference_id = ${matches.id}
        )`,
      ),
    );

  const pending = Number(pendingResult[0].count);
  const projected = actual + pending * group.tokenPerMatch;

  return { projected, actual, pending, tokenPerMatch: group.tokenPerMatch };
}
