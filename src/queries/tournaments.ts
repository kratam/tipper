import "server-only";
import { desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { tournaments } from "@/db/schema";

export async function getTournaments() {
  return db.query.tournaments.findMany({
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
    where: ne(tournaments.status, "finished"),
    orderBy: [desc(tournaments.createdAt)],
    columns: { id: true, name: true, slug: true, status: true },
  });
}
