import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { db } from "@/db";
import { matches, podiumBets, teams } from "@/db/schema";
import type { Locale } from "@/lib/providers/types";
import { withTeamDisplay } from "@/queries/team-display";

export async function getPodiumBet(userId: string, tournamentId: string) {
  return db.query.podiumBets.findFirst({
    where: and(eq(podiumBets.userId, userId), eq(podiumBets.tournamentId, tournamentId)),
  });
}

/** Get all teams that participate in a tournament (appear in its matches). */
export async function getTournamentTeams(tournamentId: string, useFlagFallback: boolean) {
  const locale = (await getLocale()) as Locale;
  const rows = await db
    .selectDistinct({
      id: teams.id,
      name: teams.name,
      logoUrl: teams.logoUrl,
    })
    .from(matches)
    .innerJoin(
      teams,
      sql`${teams.id} = ${matches.homeTeamId} OR ${teams.id} = ${matches.awayTeamId}`,
    )
    .where(eq(matches.tournamentId, tournamentId))
    .orderBy(teams.name);

  return rows.map((row) => withTeamDisplay(row, locale, useFlagFallback));
}
