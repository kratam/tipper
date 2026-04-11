import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { tournaments } from "@/db/schema";
import { backfillTournamentLogos, distributeTokensForTournament, syncTournament } from "@/lib/sync";

/**
 * Manual sync endpoint — triggered by admin panel.
 * Full sync for all active + upcoming tournaments.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeTournaments = await db.query.tournaments.findMany({
    where: eq(tournaments.status, "active"),
  });
  const upcomingTournaments = await db.query.tournaments.findMany({
    where: eq(tournaments.status, "upcoming"),
  });
  const allTournaments = [...activeTournaments, ...upcomingTournaments];

  await backfillTournamentLogos(allTournaments);

  for (const tournament of allTournaments) {
    await syncTournament(tournament);
  }

  for (const tournament of activeTournaments) {
    await distributeTokensForTournament(tournament.id);
  }

  return NextResponse.json({
    ok: true,
    synced: allTournaments.length,
    tokenDistribution: activeTournaments.length,
  });
}
