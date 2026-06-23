import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { tournaments } from "@/db/schema";
import {
  backfillTournamentLogos,
  distributeTokensForTournament,
  scheduleNextFinishCheck,
  syncTournament,
} from "@/lib/sync";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Load all tournaments
  const activeTournaments = await db.query.tournaments.findMany({
    where: eq(tournaments.status, "active"),
  });
  const upcomingTournaments = await db.query.tournaments.findMany({
    where: eq(tournaments.status, "upcoming"),
  });
  const allTournaments = [...activeTournaments, ...upcomingTournaments];

  // 2. Logo backfill (one-time per tournament, API call only if logoUrl is NULL)
  await backfillTournamentLogos(allTournaments);

  // 3. Full sync for all tournaments (fixtures + odds + schedule overrides)
  for (const tournament of allTournaments) {
    await syncTournament(tournament);
  }

  // 4. Token distribution (DB only, active tournaments)
  for (const tournament of activeTournaments) {
    await distributeTokensForTournament(tournament.id);
  }

  // 5. Match-finish lánc fenntartása tornánként (egyetlen, dedup-olt lánc;
  //    a guard miatt élő láncot nem duplikál, elveszettet újraindít).
  for (const tournament of activeTournaments) {
    await scheduleNextFinishCheck(tournament.id);
  }

  return NextResponse.json({
    ok: true,
    synced: allTournaments.length,
    tokenDistribution: activeTournaments.length,
    finishChains: activeTournaments.length,
  });
}
