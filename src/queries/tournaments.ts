import "server-only";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { tournaments } from "@/db/schema";

export async function getTournaments(opts?: { includeArchived?: boolean }) {
  return db.query.tournaments.findMany({
    where: opts?.includeArchived ? undefined : eq(tournaments.isArchived, false),
    orderBy: [desc(tournaments.createdAt)],
  });
}

export async function getTournamentBySlug(slug: string) {
  return db.query.tournaments.findFirst({
    where: eq(tournaments.slug, slug),
  });
}

export async function getActiveTournaments() {
  return db.query.tournaments.findMany({
    where: and(ne(tournaments.status, "finished"), eq(tournaments.isArchived, false)),
    orderBy: [desc(tournaments.createdAt)],
    columns: { id: true, name: true, slug: true, status: true },
  });
}
