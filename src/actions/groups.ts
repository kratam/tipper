"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { bets, groupMembers, groups, tokenLedger, tournaments } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { isReservedOfficialSlug } from "@/lib/official-group";
import { distributeInitialTokens } from "@/lib/tokens";
import { generateInviteCode, slugify } from "@/lib/utils";
import { getGroupByInviteCode } from "@/queries/groups";

interface CreateGroupInput {
  name: string;
  tournamentId: string;
  isPublic?: boolean;
  description?: string;
  tokenPerMatch?: number;
  initialTokens?: number;
  bonusGoalDiff?: number;
  bonusExactScore?: number;
  bonusPodiumMention?: number;
  bonusPodiumExact?: number;
  oddsBoost?: number;
  lossPercentage?: number;
}

export async function createGroup(input: CreateGroupInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  if (!input.name || input.name.trim().length < 2) {
    throw new Error("Group name must be at least 2 characters");
  }

  if (input.lossPercentage != null && (input.lossPercentage < 0 || input.lossPercentage > 100)) {
    throw new Error("lossPercentage must be between 0 and 100");
  }

  const tournament = await db.query.tournaments.findFirst({
    where: eq(tournaments.id, input.tournamentId),
  });
  if (!tournament) throw new Error("Tournament not found");

  const slug = slugify(input.name);
  if (isReservedOfficialSlug(slug)) {
    throw new Error("officialGroupNameReserved");
  }
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
      ...(input.bonusGoalDiff != null && { bonusGoalDiff: input.bonusGoalDiff }),
      ...(input.bonusExactScore != null && { bonusExactScore: input.bonusExactScore }),
      ...(input.bonusPodiumMention != null && { bonusPodiumMention: input.bonusPodiumMention }),
      ...(input.bonusPodiumExact != null && { bonusPodiumExact: input.bonusPodiumExact }),
      ...(input.oddsBoost != null && { oddsBoost: input.oddsBoost }),
      ...(input.lossPercentage != null && { lossPercentage: input.lossPercentage }),
      ...(input.isPublic != null && { isPublic: input.isPublic }),
      ...(input.description != null && { description: input.description }),
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
    tournament.timezone,
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
    group.tournament.timezone,
  );

  redirect(`/tournaments/${group.tournament.slug}/groups/${group.slug}`);
}

export async function joinPublicGroup(groupId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const group = await db.query.groups.findFirst({
    where: and(eq(groups.id, groupId), eq(groups.isPublic, true)),
    with: { tournament: true },
  });
  if (!group) throw new Error("Group not found");
  if (group.tournament.status === "finished") {
    throw new Error("Tournament has finished");
  }

  const existing = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)),
  });
  if (existing) throw new Error("Already a member of this group");

  await db.insert(groupMembers).values({
    groupId: group.id,
    userId: user.id,
  });

  await distributeInitialTokens(
    user.id,
    group.id,
    group.tournamentId,
    group.initialTokens,
    group.tokenPerMatch,
    group.tournament.timezone,
  );
}

interface GroupSettings {
  isPublic?: boolean;
  description?: string | null;
  tokenPerMatch?: number;
  initialTokens?: number;
  bonusGoalDiff?: number;
  bonusExactScore?: number;
  bonusPodiumMention?: number;
  bonusPodiumExact?: number;
  oddsBoost?: number;
  lossPercentage?: number;
}

export async function updateGroupSettings(groupId: string, settings: GroupSettings) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
    with: { tournament: true },
  });
  if (!group) throw new Error("Group not found");
  const canEdit = group.ownerId === user.id || (user.isAdmin && group.isOfficial);
  if (!canEdit) throw new Error("Unauthorized");

  // isPublic and description can always be changed
  // Game rules can only be changed when tournament is upcoming
  const { isPublic, description, ...gameSettings } = settings;

  if (
    gameSettings.lossPercentage != null &&
    (gameSettings.lossPercentage < 0 || gameSettings.lossPercentage > 100)
  ) {
    throw new Error("lossPercentage must be between 0 and 100");
  }

  const alwaysUpdatable: Record<string, unknown> = {};
  if (isPublic != null) alwaysUpdatable.isPublic = isPublic;
  if (description !== undefined) alwaysUpdatable.description = description;

  const hasGameSettings = Object.values(gameSettings).some((v) => v != null);
  if (hasGameSettings && group.tournament.status !== "upcoming") {
    throw new Error("Settings can only be changed while tournament is upcoming");
  }

  const updates = { ...alwaysUpdatable, ...(hasGameSettings ? gameSettings : {}) };
  if (Object.keys(updates).length > 0) {
    await db.update(groups).set(updates).where(eq(groups.id, groupId));
  }
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
  if (group.isOfficial) throw new Error("cannotDeleteOfficial");
  if (group.ownerId !== user.id) throw new Error("Unauthorized");

  // Delete in FK order (podium bets are tournament-scoped, not group-scoped)
  await db.delete(tokenLedger).where(eq(tokenLedger.groupId, groupId));
  await db.delete(bets).where(eq(bets.groupId, groupId));
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
  if (group.isOfficial) throw new Error("cannotLeaveOfficial");
  if (group.ownerId === user.id) {
    throw new Error("Owner cannot leave the group. Transfer ownership or delete the group.");
  }

  await db
    .delete(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)));
}
