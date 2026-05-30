import "server-only";
import { and, desc, eq, ne } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { tournaments } from "@/db/schema";

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
