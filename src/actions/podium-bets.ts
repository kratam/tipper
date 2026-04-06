"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { podiumBets, tournaments } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/user-sync";

interface PlacePodiumBetInput {
  tournamentId: string;
  goldTeamId: string;
  silverTeamId: string;
  bronzeTeamId: string;
}

export async function placePodiumBet(input: PlacePodiumBetInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const { tournamentId, goldTeamId, silverTeamId, bronzeTeamId } = input;

  // Check podiumLockDate hasn't passed
  const tournament = await db.query.tournaments.findFirst({
    where: eq(tournaments.id, tournamentId),
  });
  if (!tournament) throw new Error("Tournament not found");
  if (new Date() > tournament.podiumLockDate) {
    throw new Error("Podium lock date has passed");
  }

  const existing = await db.query.podiumBets.findFirst({
    where: and(eq(podiumBets.userId, user.id), eq(podiumBets.tournamentId, tournamentId)),
  });

  if (existing) {
    await db
      .update(podiumBets)
      .set({ goldTeamId, silverTeamId, bronzeTeamId })
      .where(eq(podiumBets.id, existing.id));
    return existing.id;
  }

  const [newBet] = await db
    .insert(podiumBets)
    .values({
      userId: user.id,
      tournamentId,
      goldTeamId,
      silverTeamId,
      bronzeTeamId,
    })
    .returning({ id: podiumBets.id });

  return newBet.id;
}
