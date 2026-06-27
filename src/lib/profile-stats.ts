/**
 * Pure profil-statisztika segédfüggvények.
 * Nincsenek DB-függőségek — könnyen unit-tesztelhető.
 */

export interface BetStatInput {
  result1x2Correct: boolean | null;
}

/**
 * Tipp-pontosság: a lepontozódott (result1x2Correct !== null) tippek közül
 * hány százalék helyes. Értéke 0–100, egész szám (Math.round).
 * Ha nincs lepontozódott tipp (üres lista v. csak null-ok), 0 adódik.
 */
export function hitRate(bets: BetStatInput[]): number {
  const scored = bets.filter((b) => b.result1x2Correct !== null);
  if (scored.length === 0) return 0;
  const correct = scored.filter((b) => b.result1x2Correct === true).length;
  return Math.round((correct / scored.length) * 100);
}
