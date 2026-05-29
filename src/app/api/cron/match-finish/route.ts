import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { matches, tournaments } from "@/db/schema";
import { expectedMatchDurationMs } from "@/lib/match-duration";
import { scheduleMatchFinishCheck } from "@/lib/qstash";
import { syncFixtures } from "@/lib/sync";

const LIVE_RECHECK_SECONDS = 10 * 60; // 10 min

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeTournaments = await db.query.tournaments.findMany({
    where: eq(tournaments.status, "active"),
  });

  if (activeTournaments.length === 0) {
    return NextResponse.json({ ok: true, action: "no_active_tournaments" });
  }

  // Sync fixtures only (no odds) — checks for finished/cancelled matches and scores them
  for (const tournament of activeTournaments) {
    await syncFixtures(tournament);
  }

  // Check if there are still live matches
  const activeTournamentIds = activeTournaments.map((t) => t.id);
  const liveCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(matches)
    .where(and(sql`${matches.tournamentId} IN ${activeTournamentIds}`, eq(matches.status, "live")));

  if (Number(liveCount[0].count) > 0) {
    // Still live matches → recheck in 10 min
    await scheduleMatchFinishCheck(LIVE_RECHECK_SECONDS);
    return NextResponse.json({
      ok: true,
      action: "rescheduled_live",
      delaySeconds: LIVE_RECHECK_SECONDS,
    });
  }

  // No live matches — check if there are more scheduled matches today
  const remainingToday = await db
    .select({ tournamentId: matches.tournamentId, scheduledAt: matches.scheduledAt })
    .from(matches)
    .where(
      and(
        sql`${matches.tournamentId} IN ${activeTournamentIds}`,
        eq(matches.status, "scheduled"),
        sql`DATE(${matches.scheduledAt}) = CURRENT_DATE`,
      ),
    );

  if (remainingToday.length > 0) {
    // Find earliest remaining match, schedule at its sport-specific expected end time
    const durationByTournament = new Map(
      activeTournaments.map((t) => [t.id, expectedMatchDurationMs(t.providerSport)]),
    );
    const earliest = remainingToday.reduce((min, m) => (m.scheduledAt < min.scheduledAt ? m : min));
    const duration =
      durationByTournament.get(earliest.tournamentId) ?? expectedMatchDurationMs(null);
    const expectedEnd = earliest.scheduledAt.getTime() + duration;
    const delaySeconds = Math.max(60, Math.ceil((expectedEnd - Date.now()) / 1000));

    await scheduleMatchFinishCheck(delaySeconds);
    return NextResponse.json({ ok: true, action: "rescheduled_next_match", delaySeconds });
  }

  // All done for today — no reschedule, Neon can sleep
  return NextResponse.json({ ok: true, action: "all_done" });
}
