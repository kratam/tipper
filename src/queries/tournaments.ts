import "server-only";
import { db } from "@/db";
import { tournaments } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

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
