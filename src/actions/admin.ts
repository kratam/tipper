"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { groups, podiumBets, tokenLedger, tournaments } from "@/db/schema";
import { fetchLeagueLogoUrl } from "@/lib/api-sports";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { calculatePodiumPoints } from "@/lib/scoring";
import { slugify } from "@/lib/utils";

export async function triggerSync() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  if (!user.isAdmin) throw new Error("Unauthorized");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/cron/sync`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
  });

  if (!res.ok) throw new Error("Sync failed");
  return res.json();
}

interface CreateTournamentInput {
  name: string;
  apiLeagueId: number;
  apiSeason: number;
  podiumLockDate: Date;
  timezone: string;
}

export async function createTournament(input: CreateTournamentInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  if (!user.isAdmin) throw new Error("Unauthorized");

  const slug = slugify(input.name);
  const logoUrl = await fetchLeagueLogoUrl(input.apiLeagueId);

  const [tournament] = await db
    .insert(tournaments)
    .values({
      name: input.name,
      slug,
      apiLeagueId: input.apiLeagueId,
      apiSeason: input.apiSeason,
      podiumLockDate: input.podiumLockDate,
      timezone: input.timezone,
      logoUrl,
    })
    .returning();

  return tournament;
}

export async function updateTournamentName(tournamentId: string, name: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  if (!user.isAdmin) throw new Error("Unauthorized");

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name cannot be empty");

  await db.update(tournaments).set({ name: trimmed }).where(eq(tournaments.id, tournamentId));
}

export async function updateTournamentPodiumLockDate(tournamentId: string, podiumLockDate: Date) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  if (!user.isAdmin) throw new Error("Unauthorized");

  await db.update(tournaments).set({ podiumLockDate }).where(eq(tournaments.id, tournamentId));
}

export async function updateTournamentTimezone(tournamentId: string, timezone: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  if (!user.isAdmin) throw new Error("Unauthorized");

  await db
    .update(tournaments)
    .set({ timezone: timezone.trim() })
    .where(eq(tournaments.id, tournamentId));
}

export async function updateTournamentLogo(tournamentId: string, logoUrl: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  if (!user.isAdmin) throw new Error("Unauthorized");

  await db
    .update(tournaments)
    .set({ logoUrl: logoUrl.trim() || null })
    .where(eq(tournaments.id, tournamentId));
}

type TournamentStatus = "upcoming" | "active" | "finished";

export async function updateTournamentStatus(tournamentId: string, status: TournamentStatus) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  if (!user.isAdmin) throw new Error("Unauthorized");

  await db.update(tournaments).set({ status }).where(eq(tournaments.id, tournamentId));
}

interface FinishTournamentInput {
  tournamentId: string;
  goldTeamId: string;
  silverTeamId: string;
  bronzeTeamId: string;
}

/**
 * Finish a tournament: set status to finished, record podium results,
 * and score all podium bets.
 */
export async function finishTournament(input: FinishTournamentInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  if (!user.isAdmin) throw new Error("Unauthorized");

  const { tournamentId, goldTeamId, silverTeamId, bronzeTeamId } = input;

  // Update tournament with podium results and set finished
  await db
    .update(tournaments)
    .set({
      status: "finished",
      goldTeamId,
      silverTeamId,
      bronzeTeamId,
    })
    .where(eq(tournaments.id, tournamentId));

  // Score all podium bets for this tournament
  const allPodiumBets = await db.query.podiumBets.findMany({
    where: eq(podiumBets.tournamentId, tournamentId),
  });

  const actual = { gold: goldTeamId, silver: silverTeamId, bronze: bronzeTeamId };

  for (const bet of allPodiumBets) {
    const group = await db.query.groups.findFirst({
      where: and(eq(groups.id, bet.groupId), eq(groups.tournamentId, tournamentId)),
    });
    if (!group) continue;

    const points = calculatePodiumPoints(
      { gold: bet.goldTeamId, silver: bet.silverTeamId, bronze: bet.bronzeTeamId },
      actual,
      {
        bonusPodiumMention: group.bonusPodiumMention,
        bonusPodiumExact: group.bonusPodiumExact,
      },
    );

    if (points > 0) {
      await db.insert(tokenLedger).values({
        userId: bet.userId,
        groupId: bet.groupId,
        tournamentId,
        amount: points,
        type: "win",
        referenceId: bet.id,
      });
    }
  }
}
