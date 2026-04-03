"use server";

import { db } from "@/db";
import { groups, groupMembers, tournaments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { generateInviteCode, slugify } from "@/lib/utils";
import { getGroupByInviteCode } from "@/queries/groups";
import { redirect } from "next/navigation";

interface CreateGroupInput {
  name: string;
  tournamentId: string;
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
    })
    .returning();

  // Auto-join creator
  await db.insert(groupMembers).values({
    groupId: group.id,
    userId: user.id,
  });

  return group;
}

export async function joinGroup(inviteCode: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const group = await getGroupByInviteCode(inviteCode);
  if (!group) throw new Error("Group not found");

  const existing = await db.query.groupMembers.findFirst({
    where: and(
      eq(groupMembers.groupId, group.id),
      eq(groupMembers.userId, user.id),
    ),
  });
  if (existing) throw new Error("Already a member of this group");

  await db.insert(groupMembers).values({
    groupId: group.id,
    userId: user.id,
  });

  redirect(`/groups/${group.slug}`);
}

interface GroupSettings {
  tokenPerRound?: number;
  bonusGoalDiff?: number;
  bonusExactScore?: number;
  bonusPodiumMention?: number;
  bonusPodiumExact?: number;
  carryoverPercent?: number;
}

export async function updateGroupSettings(
  groupId: string,
  settings: GroupSettings,
) {
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
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, targetUserId),
      ),
    );
}
