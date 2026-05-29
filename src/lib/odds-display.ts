/**
 * Effektív lekötött odds = oddsAtBet × oddsBoost, 2 tizedesre kerekítve.
 *
 * Ez a tétre ható tényleges szorzó: `payout = stake × oddsAtBet × oddsBoost`,
 * vagyis ez = `payout / stake`. Konzisztens a bet-form `(...)` feliratával.
 *
 * @returns A formázott odds string (pl. "1.70"), vagy `null` ha nincs rögzített
 *   odds (régi tippek, vagy a tipp leadásakor nem volt elérhető odds).
 */
export function formatEffectiveOdds(oddsAtBet: string | null, oddsBoost: number): string | null {
  if (oddsAtBet === null) return null;
  return (Number(oddsAtBet) * oddsBoost).toFixed(2);
}
