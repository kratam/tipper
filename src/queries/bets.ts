import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bets } from "@/db/schema";

export async function getUserBetsForMatch(userId: string, matchId: string) {
  return db.query.bets.findMany({
    where: and(eq(bets.userId, userId), eq(bets.matchId, matchId)),
    with: {
      group: true,
    },
  });
}

export async function getGroupBetsForFinishedMatches(groupId: string) {
  return db.query.bets
    .findMany({
      where: eq(bets.groupId, groupId),
      with: {
        user: true,
        match: true,
      },
    })
    .then((allBets) => allBets.filter((bet) => bet.match.status === "finished"));
}

export async function getUserBetsForTournament(userId: string, tournamentId: string) {
  return db.query.bets
    .findMany({
      where: eq(bets.userId, userId),
      with: {
        match: {
          with: {
            homeTeam: true,
            awayTeam: true,
            tournament: true,
          },
        },
        group: true,
      },
    })
    .then((allBets) => allBets.filter((bet) => bet.match.tournamentId === tournamentId));
}
