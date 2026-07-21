import "server-only";
import { sql } from "drizzle-orm";
import { matches, podiumBets, tokenLedger } from "@/db/schema";

/**
 * Az "eddigi eredmény" (profit) összeg-kifejezése — MINDEN hívóhelyen ezt
 * használd, hogy a ranglista, a csoportkártya és a profil ugyanazt a számot
 * mutassa.
 *
 * Egy `bet`/`win`/`refund` ledger-sor akkor számít bele, ha:
 *   a) meccshez kötött, és a meccs lezárult vagy elmaradt (`matches.status`), VAGY
 *   b) dobogó-tipphez kötött (`podium_bets`) — ezek a torna lezárásakor
 *      keletkeznek, meccs nélkül.
 *
 * A (b) ág nélkül a dobogó-bónusz némán elveszett: a `reference_id` egy
 * podium_bets id, ami a `bets`-hez nem joinol, így a `matches.status` NULL
 * lett és a CASE 0-t adott. A tokenek a ledgerben és az egyenlegben ott
 * voltak, csak a profitból hiányoztak.
 *
 * Szándékosan NEM `bets.id IS NULL`-lal fogalmazva: vannak árva `bet`/`refund`
 * sorok is (törölt tippek nyomai, párban kioltják egymást) — azok maradnak
 * kívül.
 *
 * A használatához a lekérdezésnek joinolnia kell a `bets` → `matches` láncot
 * ÉS a `podiumBets` táblát a `tokenLedger.referenceId`-n keresztül.
 */
export function resolvedProfitSum() {
  return sql<number>`COALESCE(SUM(CASE WHEN ${matches.status} IN ('finished', 'cancelled') OR ${podiumBets.id} IS NOT NULL THEN ${tokenLedger.amount} ELSE 0 END), 0)`;
}
