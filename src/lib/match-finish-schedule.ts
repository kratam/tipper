// A match-finish recheck-lánc döntéslogikája. Tiszta (DB/IO nélkül), hogy
// unit-tesztelhető legyen — lásd tests/lib/match-finish-schedule.test.ts.

export const RECHECK_INTERVAL_MS = 3 * 60 * 1000; // 3 perc

export interface PendingMatch {
  scheduledAt: Date;
  status: "scheduled" | "live";
  durationMs: number;
}

/**
 * A következő match-finish check ideje, vagy null ha nincs több lezáratlan meccs.
 * - Üres lista → null (a lánc leáll).
 * - Van olyan meccs, aminek a várható vége már elmúlt (várjuk az eredményt) →
 *   sűrű recheck: now + RECHECK_INTERVAL_MS.
 * - Különben → a legkorábbi várható meccs-vég (addig nulla hívás).
 */
export function computeNextFinishCheck(pending: PendingMatch[], now: Date): Date | null {
  if (pending.length === 0) return null;
  const ends = pending.map((m) => m.scheduledAt.getTime() + m.durationMs);
  const hasOverdue = ends.some((end) => end <= now.getTime());
  if (hasOverdue) return new Date(now.getTime() + RECHECK_INTERVAL_MS);
  return new Date(Math.min(...ends));
}

/** QStash delay másodpercben, minimum 60s padlóval (a meglévő konvenció). */
export function delaySecondsUntil(target: Date, now: Date): number {
  return Math.max(60, Math.ceil((target.getTime() - now.getTime()) / 1000));
}
