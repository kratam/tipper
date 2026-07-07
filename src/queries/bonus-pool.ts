import "server-only";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { bets } from "@/db/schema";
import { dateToDateNum } from "@/lib/tokens";

/**
 * Tippelőnként a rendezett tét-nettók (payout − stake) összege az M-nél KORÁBBI
 * dátumú, már lepontozott tippjeikből ebben a csoportban. Dátum-alapú (nem M
 * saját tipp-/ledger-állapotától függ) → a pool-alap idempotens marad
 * újrapontozásra és párhuzamos cron-futásokra is. A scoring (sync.ts) és a
 * Statisztika-tab pool-kijelzése (queries/bets.ts) közösen hívja, hogy a
 * megjelenített keret a tényleges kifizetéssel egyezzen.
 */
export async function getBettorResolvedNets(
  groupId: string,
  bettorIds: string[],
  timeZone: string,
  matchDateNum: number,
): Promise<Map<string, number>> {
  const nets = new Map<string, number>();
  if (bettorIds.length === 0) return nets;

  const resolved = await db.query.bets.findMany({
    where: and(eq(bets.groupId, groupId), inArray(bets.userId, bettorIds), isNotNull(bets.payout)),
    columns: { userId: true, stake: true, payout: true },
    with: { match: { columns: { scheduledAt: true } } },
  });

  for (const b of resolved) {
    if (b.payout == null) continue;
    if (dateToDateNum(b.match.scheduledAt, timeZone) >= matchDateNum) continue;
    nets.set(b.userId, (nets.get(b.userId) ?? 0) + (b.payout - b.stake));
  }
  return nets;
}
