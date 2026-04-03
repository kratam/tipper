"use server";

import { db } from "@/db";
import { tournaments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { slugify } from "@/lib/utils";

interface CreateTournamentInput {
  name: string;
  apiLeagueId: number;
  apiSeason: number;
  podiumLockDate: Date;
}

export async function createTournament(input: CreateTournamentInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  if (!user.isAdmin) throw new Error("Unauthorized");

  const slug = slugify(input.name);

  const [tournament] = await db
    .insert(tournaments)
    .values({
      name: input.name,
      slug,
      apiLeagueId: input.apiLeagueId,
      apiSeason: input.apiSeason,
      podiumLockDate: input.podiumLockDate,
    })
    .returning();

  return tournament;
}

type TournamentStatus = "upcoming" | "active" | "finished";

export async function updateTournamentStatus(
  tournamentId: string,
  status: TournamentStatus,
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  if (!user.isAdmin) throw new Error("Unauthorized");

  await db
    .update(tournaments)
    .set({ status })
    .where(eq(tournaments.id, tournamentId));
}
