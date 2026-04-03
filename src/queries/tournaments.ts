import "server-only";
import { desc, eq } from "drizzle-orm";
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
