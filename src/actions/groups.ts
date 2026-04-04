"use server";

import { and, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { bets, groupMembers, groups, podiumBets, tokenLedger, tournaments } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { generateInviteCode, slugify } from "@/lib/utils";
import { getGroupByInviteCode } from "@/queries/groups";

interface CreateGroupInput {
  name: string;
  tournamentId: string;
  tokenPerMatch?: number;
  initialTokens?: number;
  distributionDaysBefore?: number;
  bonusGoalDiff?: number;
  bonusExactScore?: number;
  bonusPodiumMention?: number;
  bonusPodiumExact?: number;
}

export async function createGroup(input: CreateGroupInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  if (!input.name || input.name.trim().length < 2) {
    throw new Error("Group name must be at least 2 characters");
  }

  const tournament = await db.query.tournaments.findFirst({
    where: eq(tournaments.id, input.tournamentId),
  });
  if (!tournament) throw new Error("Tournament not found");

  const slug = slugify(input.name);
  const inviteCode = generateInviteCode();

  const [group] = await db
    .insert(groups)
    .values({
      name: input.name.trim(),
      slug,
      inviteCode,
      ownerId: user.id,
      tournamentId: input.tournamentId,
      ...(input.tokenPerMatch != null && { tokenPerMatch: input.tokenPerMatch }),
      ...(input.initialTokens != null && { initialTokens: input.initialTokens }),
      ...(input.distributionDaysBefore != null && {
        distributionDaysBefore: input.distributionDaysBefore,
      }),
      ...(input.bonusGoalDiff != null && { bonusGoalDiff: input.bonusGoalDiff }),
      ...(input.bonusExactScore != null && { bonusExactScore: input.bonusExactScore }),
      ...(input.bonusPodiumMention != null && { bonusPodiumMention: input.bonusPodiumMention }),
      ...(input.bonusPodiumExact != null && { bonusPodiumExact: input.bonusPodiumExact }),
    })
    .returning();

  // Auto-join creator
  await db.insert(groupMembers).values({
    groupId: group.id,
    userId: user.id,
  });

  // Distribute initial tokens for the current round
  await distributeInitialTokens(
    user.id,
    group.id,
    input.tournamentId,
    group.initialTokens,
    group.tokenPerMatch,
  );

  return group;
}

export async function joinGroup(inviteCode: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const group = await getGroupByInviteCode(inviteCode);
  if (!group) throw new Error("Group not found");

  const existing = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, user.id)),
  });
  if (existing) throw new Error("Already a member of this group");

  await db.insert(groupMembers).values({
    groupId: group.id,
    userId: user.id,
  });

  // Distribute initial tokens for the current round
  await distributeInitialTokens(
    user.id,
    group.id,
    group.tournamentId,
    group.initialTokens,
    group.tokenPerMatch,
  );

  redirect(`/groups/${group.slug}`);
}

interface GroupSettings {
  tokenPerMatch?: number;
  initialTokens?: number;
  distributionDaysBefore?: number;
  bonusGoalDiff?: number;
  bonusExactScore?: number;
  bonusPodiumMention?: number;
  bonusPodiumExact?: number;
}

export async function updateGroupSettings(groupId: string, settings: GroupSettings) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
    with: { tournament: true },
  });
  if (!group) throw new Error("Group not found");
  if (group.ownerId !== user.id) throw new Error("Unauthorized");
  if (group.tournament.status !== "upcoming") {
    throw new Error("Settings can only be changed while tournament is upcoming");
  }

  await db.update(groups).set(settings).where(eq(groups.id, groupId));
}

export async function removeMember(groupId: string, targetUserId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
  });
  if (!group) throw new Error("Group not found");
  if (group.ownerId !== user.id) throw new Error("Unauthorized");
  if (targetUserId === user.id) throw new Error("Cannot remove yourself");

  await db
    .delete(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetUserId)));
}

export async function deleteGroup(groupId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
  });
  if (!group) throw new Error("Group not found");
  if (group.ownerId !== user.id) throw new Error("Unauthorized");

  // Delete in FK order
  await db.delete(tokenLedger).where(eq(tokenLedger.groupId, groupId));
  await db.delete(bets).where(eq(bets.groupId, groupId));
  await db.delete(podiumBets).where(eq(podiumBets.groupId, groupId));
  await db.delete(groupMembers).where(eq(groupMembers.groupId, groupId));
  await db.delete(groups).where(eq(groups.id, groupId));
}

export async function leaveGroup(groupId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
  });
  if (!group) throw new Error("Group not found");
  if (group.ownerId === user.id) {
    throw new Error("Owner cannot leave the group. Transfer ownership or delete the group.");
  }

  await db
    .delete(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)));
}

/**
 * Give a user their initial tokens + catch-up tokens for all matches
 * that have already been distributed in this group.
 */
async function distributeInitialTokens(
  userId: string,
  groupId: string,
  tournamentId: string,
  initialTokens: number,
  tokenPerMatch: number,
): Promise<void> {
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
