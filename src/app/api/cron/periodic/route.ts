import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { matches, tournaments } from "@/db/schema";
import { expectedMatchDurationMs } from "@/lib/match-duration";
import { scheduleMatchFinishCheck } from "@/lib/qstash";
import { backfillTournamentLogos, distributeTokensForTournament, syncTournament } from "@/lib/sync";

// 6 óránként fut (vercel.json: 0 0,6,12,18 * * *). A QStash match-finish
// checkeket csak a következő 6 órás ablakban kezdődő meccsekre lövi ki, így a
// 4 napi futás átfedés nélkül tölti ki a napot — nincs duplikált QStash üzenet.
const CRON_WINDOW_MS = 6 * 60 * 60 * 1000;

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

  // 5. Schedule QStash calls for matches starting in the next 6h window
  //    (match-finish checks, per-sport expected duration)
  let scheduledChecks = 0;
  if (activeTournaments.length > 0) {
    const activeTournamentIds = activeTournaments.map((t) => t.id);
    const durationByTournament = new Map(
      activeTournaments.map((t) => [t.id, expectedMatchDurationMs(t.providerSport)]),
    );

    const now = Date.now();
    const windowEnd = new Date(now + CRON_WINDOW_MS);

    const windowMatches = await db
      .select({ tournamentId: matches.tournamentId, scheduledAt: matches.scheduledAt })
      .from(matches)
      .where(
        and(
          sql`${matches.tournamentId} IN ${activeTournamentIds}`,
          eq(matches.status, "scheduled"),
          sql`${matches.scheduledAt} >= NOW()`,
          sql`${matches.scheduledAt} < ${windowEnd}`,
        ),
      );

    if (windowMatches.length > 0) {
      // Group by expected end time (rounded to 15 min) to avoid duplicate calls
      const endTimeBuckets = new Set<number>();
      for (const match of windowMatches) {
        const duration =
          durationByTournament.get(match.tournamentId) ?? expectedMatchDurationMs(null);
        const expectedEnd = match.scheduledAt.getTime() + duration;
        const rounded = Math.ceil(expectedEnd / (15 * 60 * 1000)) * (15 * 60 * 1000);
        endTimeBuckets.add(rounded);
      }

      for (const endTime of endTimeBuckets) {
        const delaySeconds = Math.max(60, Math.ceil((endTime - now) / 1000));
        await scheduleMatchFinishCheck(delaySeconds);
        scheduledChecks++;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    synced: allTournaments.length,
    tokenDistribution: activeTournaments.length,
    scheduledChecks,
  });
}
