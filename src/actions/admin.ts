"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { groupMembers, groups, podiumBets, tokenLedger, tournaments } from "@/db/schema";
import { fetchLeagueLogoUrl } from "@/lib/api-sports";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { createOfficialGroup } from "@/lib/official-group";
import type { ProviderId } from "@/lib/providers/types";
import { calculatePodiumPoints } from "@/lib/scoring";
import { backfillTournamentLogos, distributeTokensForTournament, syncTournament } from "@/lib/sync";
import { slugify } from "@/lib/utils";

export async function triggerSync() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  if (!user.isAdmin) throw new Error("Unauthorized");

  const activeTournaments = await db.query.tournaments.findMany({
    where: eq(tournaments.status, "active"),
  });
  const upcomingTournaments = await db.query.tournaments.findMany({
    where: eq(tournaments.status, "upcoming"),
  });
  const allTournaments = [...activeTournaments, ...upcomingTournaments];

  await backfillTournamentLogos(allTournaments);

  const errors: { name: string; error: string }[] = [];

  for (const tournament of allTournaments) {
    try {
      await syncTournament(tournament);
    } catch (e) {
      errors.push({
        name: tournament.name,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  for (const tournament of activeTournaments) {
    try {
      await distributeTokensForTournament(tournament.id);
    } catch (e) {
      errors.push({
        name: tournament.name,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  if (errors.length > 0) {
    throw new Error(`Sync errors: ${errors.map((x) => `${x.name}: ${x.error}`).join("; ")}`);
  }

  return {
    ok: true,
    synced: allTournaments.length,
    tokenDistribution: activeTournaments.length,
  };
}

interface CreateTournamentInput {
  name: string;
  provider: ProviderId;
  apiLeagueId: number | null;
  apiSeason: number | null;
  providerSport: string | null;
  providerLeagueSlug: string | null;
  useFlagFallback: boolean;
  podiumLockDate: Date;
  timezone: string;
}

export async function createTournament(input: CreateTournamentInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  if (!user.isAdmin) throw new Error("Unauthorized");

  const slug = slugify(input.name);
  const logoUrl =
    input.provider === "api-sports" && input.apiLeagueId != null
      ? await fetchLeagueLogoUrl(input.apiLeagueId)
      : null;

  const [tournament] = await db
    .insert(tournaments)
    .values({
      name: input.name,
      slug,
      provider: input.provider,
      apiLeagueId: input.apiLeagueId,
      apiSeason: input.apiSeason,
      providerSport: input.providerSport,
      providerLeagueSlug: input.providerLeagueSlug,
      useFlagFallback: input.useFlagFallback,
      podiumLockDate: input.podiumLockDate,
      timezone: input.timezone,
      logoUrl,
    })
    .returning();

  // Auto-create the official group for this tournament. If this fails the
  // tournament still exists — the backfill SQL is idempotent and can be
  // re-run to add the official group later.
  await createOfficialGroup(tournament.id);

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

export async function setTournamentArchived(tournamentId: string, isArchived: boolean) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  if (!user.isAdmin) throw new Error("Unauthorized");

  if (isArchived) {
    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
      columns: { status: true },
    });
    if (!tournament) throw new Error("Tournament not found");
    if (tournament.status !== "finished") {
      throw new Error("Only finished tournaments can be archived");
    }
  }

  await db.update(tournaments).set({ isArchived }).where(eq(tournaments.id, tournamentId));
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

  // All groups in this tournament
  const tournamentGroups = await db.query.groups.findMany({
    where: eq(groups.tournamentId, tournamentId),
  });

  for (const bet of allPodiumBets) {
    // Find all groups the user belongs to in this tournament
    const userMemberships = await db.query.groupMembers.findMany({
      where: eq(groupMembers.userId, bet.userId),
    });
    const userGroupIds = new Set(userMemberships.map((m) => m.groupId));
    const userGroups = tournamentGroups.filter((g) => userGroupIds.has(g.id));

    const prediction = { gold: bet.goldTeamId, silver: bet.silverTeamId, bronze: bet.bronzeTeamId };

    for (const group of userGroups) {
      const points = calculatePodiumPoints(prediction, actual, {
        bonusPodiumMention: group.bonusPodiumMention,
        bonusPodiumExact: group.bonusPodiumExact,
      });

      if (points > 0) {
        await db.insert(tokenLedger).values({
          userId: bet.userId,
          groupId: group.id,
          tournamentId,
          amount: points,
          type: "win",
          referenceId: bet.id,
        });
      }
    }
  }
}
