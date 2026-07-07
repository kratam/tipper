/**
 * A profil tét-táblázat tiszta (UI-független) segédfüggvényei.
 * A DB-aggregátumokat a `queries/profile.ts` adja; itt csak a rendezés / megjelenítési
 * döntések élnek, hogy Vitest-tel önállóan tesztelhetők legyenek.
 */

/**
 * Egy lezárt tét nettó eredménye. A tárolt `payout` már tartalmazza a vesztés-
 * visszatérítést (vesztésnél a tét egy hányada), ezért a nettó mindig `payout - stake`.
 * `null` payout (még nem kiértékelt) esetén a teljes tét a veszteség.
 */
export function netProfit(payout: number | null, stake: number): number {
  return payout != null ? payout - stake : -stake;
}

/**
 * Csak akkor mutatunk csoport-badge-et a soroknál, ha a tornán belül egynél több
 * official csoportban van tétje a usernek (különben zaj lenne).
 */
export function shouldShowGroupBadge(distinctGroupCount: number): boolean {
  return distinctGroupCount > 1;
}

export interface SortableBetRow {
  scheduledAt: string;
}

/** Tét-sorok meccs-idő szerint csökkenő sorrendben (nem mutálja a bemenetet). */
export function sortBetRowsByScheduledDesc<T extends SortableBetRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
}

export interface SortableTournamentSummary {
  status: string;
  lastMatchAt: string;
}

/**
 * Torna-összegzők: az aktív sorozatok elöl (nyitva indulnak), utána az utolsó
 * meccs ideje szerint csökkenő. Nem mutálja a bemenetet.
 */
export function sortTournamentSummaries<T extends SortableTournamentSummary>(list: T[]): T[] {
  const rank = (status: string) => (status === "active" ? 0 : 1);
  return [...list].sort((a, b) => {
    const byStatus = rank(a.status) - rank(b.status);
    if (byStatus !== 0) return byStatus;
    return b.lastMatchAt.localeCompare(a.lastMatchAt);
  });
}
