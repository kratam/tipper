import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { tournaments } from "@/db/schema";
import { scheduleNextFinishCheck, syncFixtures } from "@/lib/sync";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { tournamentId?: string };

  // Torna-specifikus üzenet (új formátum) → csak azt a tornát. tournamentId nélkül
  // (régi, deploy előtti függő üzenet) → minden aktív torna, az új guard-olt
  // scheduleNextFinishCheck-kel; így a régi láncok gracefully átállnak.
  const targets = body.tournamentId
    ? await db.query.tournaments.findMany({ where: eq(tournaments.id, body.tournamentId) })
    : await db.query.tournaments.findMany({ where: eq(tournaments.status, "active") });

  for (const tournament of targets) {
    // Az odds-api hibát (429 is) elnyeljük: a route SOHA nem dob, hogy a
    // QStash ne kapjon 500-at. Az újrapróbálkozás a normál recheck-ciklusból jön.
    try {
      await syncFixtures(tournament);
    } catch (error) {
      console.error(`[match-finish] syncFixtures failed for ${tournament.id}:`, error);
    }
    // Mindig újraütemezünk — hibás sync esetén is —, a DB-ből számolva.
    await scheduleNextFinishCheck(tournament.id);
  }

  return NextResponse.json({ ok: true, processed: targets.length });
}
