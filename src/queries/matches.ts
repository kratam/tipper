import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { matches, matchOdds } from "@/db/schema";

export async function getMatchesForTournament(tournamentId: string) {
  return db.query.matches.findMany({
    where: eq(matches.tournamentId, tournamentId),
    with: {
      homeTeam: true,
      awayTeam: true,
      odds: {
        orderBy: [desc(matchOdds.fetchedAt)],
        limit: 1,
      },
    },
    orderBy: [matches.scheduledAt],
  });
}

export async function getMatchById(matchId: string) {
  return db.query.matches.findFirst({
    where: eq(matches.id, matchId),
    with: {
      homeTeam: true,
      awayTeam: true,
      tournament: true,
      odds: {
        orderBy: [desc(matchOdds.fetchedAt)],
        limit: 1,
      },
    },
  });
}

export async function getLatestOdds(matchId: string) {
  return db.query.matchOdds.findFirst({
    where: eq(matchOdds.matchId, matchId),
    orderBy: [desc(matchOdds.fetchedAt)],
  });
}
