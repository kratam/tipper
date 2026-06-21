"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { groupMembers, groups } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { getTipMatrixRound, type TipMatrixRound } from "@/queries/tip-matrix";

/**
 * Forduló-váltás a Tipp-táblán. Auth + jogosultság: a csoport tagja, vagy
 * publikus csoport (pl. a hivatalos Ranglista). Privát csoport tippjei nem
 * tagnak nem szivárognak ki.
 */
export async function getTipMatrixRoundAction(
  groupId: string,
  roundKey: string | null,
): Promise<TipMatrixRound | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
    with: { tournament: true },
  });
  if (!group) return null;

  if (!group.isPublic) {
    const membership = await db.query.groupMembers.findFirst({
      where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)),
    });
    if (!membership) return null;
  }

  return getTipMatrixRound(
    groupId,
    group.tournamentId,
    group.tournament.useFlagFallback,
    user.id,
    roundKey,
  );
}
