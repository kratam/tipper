import { NextResponse } from "next/server";
import { formatSummary, runProbe } from "@/lib/eredmenyek-probe";

// eredmenyek.com (Flashscore) megbízhatósági probe — Vercel cron végpont.
// Lefuttatja a teljes adatláncot (x-fsign harvest + detail feed + odds GraphQL)
// az anchor meccsekre, és a Vercel logba írja az összegzést. NEM ír DB-t.
// A vercel.json 5 percenként hívja; cél: pár óra/nap alatt valós megbízhatósági adat.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const record = await runProbe();

  // Alapos logolás a Vercel runtime logba (log drainnel is kereshető).
  console.log(`[eredmenyek-probe]\n${formatSummary(record)}`);

  return NextResponse.json(record);
}
