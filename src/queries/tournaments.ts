import "server-only";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { matches, tournaments } from "@/db/schema";

export async function getTournaments(opts?: { includeArchived?: boolean }) {
  return db.query.tournaments.findMany({
    where: opts?.includeArchived ? undefined : eq(tournaments.isArchived, false),
    orderBy: [desc(tournaments.createdAt)],
  });
}

// Wrapped in React cache(): the slug->tournament lookup and the nav's active
// tournament list are requested from multiple places in one render (layout +
// page). cache() dedupes them to a single DB round trip per request.
export const getTournamentBySlug = cache(async (slug: string) => {
  return db.query.tournaments.findFirst({
    where: eq(tournaments.slug, slug),
  });
});

export const getActiveTournaments = cache(async () => {
  return db.query.tournaments.findMany({
    where: and(ne(tournaments.status, "finished"), eq(tournaments.isArchived, false)),
    orderBy: [desc(tournaments.createdAt)],
    columns: { id: true, name: true, slug: true, status: true },
  });
});

// A legutóbb befejezett versenysorozat — ez a landing default, ha nincs aktív.
// Nincs finishedAt oszlop, ezért az utolsó meccs kezdete a rendezési kulcs
// (createdAt fallbackkel, ha egy sorozathoz még nincs meccs).
export const getLastFinishedTournament = cache(async () => {
  const rows = await db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      slug: tournaments.slug,
      status: tournaments.status,
    })
    .from(tournaments)
    .leftJoin(matches, eq(matches.tournamentId, tournaments.id))
    .where(and(eq(tournaments.status, "finished"), eq(tournaments.isArchived, false)))
    .groupBy(tournaments.id)
    .orderBy(desc(sql`coalesce(max(${matches.scheduledAt}), ${tournaments.createdAt})`))
    .limit(1);

  return rows[0];
});
