// Az élő polling (tabella + meccsek) csak akkor fut, ha épp meccs-ablakban
// vagyunk: kickoff előtt 10 perctől a kezdés után 3 óráig (meccs + lezárás/
// scoring). Ezen kívül az adat úgyse változik, így nem kérdezzük a DB-t — ezért a
// Neon compute el tud aludni (scale-to-zero).
// Lásd: use-leaderboard-polling.ts, use-match-polling.ts.

export const POLL_LEAD_MS = 10 * 60 * 1000;
export const POLL_WINDOW_MS = 3 * 60 * 60 * 1000;

/** Igaz, ha `now` legalább egy meccs [kickoff − LEAD, kickoff + WINDOW]
 *  ablakába esik. A `matchTimes` epoch-ms időpontok. */
export function inMatchWindow(matchTimes: readonly number[], now: number): boolean {
  return matchTimes.some((t) => now >= t - POLL_LEAD_MS && now <= t + POLL_WINDOW_MS);
}
