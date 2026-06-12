/**
 * Lezárt tippek megjelenítési helperei (tipp-szín, bónusz visszaszámolás).
 * A csoport-eredmények és a ranglista tipplistái közösen használják.
 */
export interface BetOutcome {
  result1x2Correct: boolean | null;
  goalDiffCorrect: boolean | null;
  exactScoreCorrect: boolean | null;
  payout: number | null;
  stake: number;
  oddsAtBet: string | null;
}

/**
 * A tipp szövegszíne a találat pontossága szerint:
 * telitalálat → félkövér zöld, gólkülönbség → semibold zöld,
 * csak 1X2 → halvány zöld, rossz tipp → halvány piros.
 */
export function predictionToneClass(bet: BetOutcome): string {
  if (bet.exactScoreCorrect) return "font-bold text-win";
  if (bet.goalDiffCorrect) return "font-semibold text-win";
  if (bet.result1x2Correct) return "font-medium text-win/70";
  return "font-medium text-loss/70";
}

/**
 * A gólkülönbség/pontos eredmény bónusz visszaszámolása a tárolt payoutból:
 * `payout = round(stake × oddsAtBet × oddsBoost) + bónuszok` (lásd lib/scoring.ts),
 * így a bónusz = payout − alapnyeremény. Telitalálatnál a két bónusz összege.
 */
export function deriveBetBonus(bet: BetOutcome, oddsBoost: number): number {
  if (!bet.goalDiffCorrect || bet.payout == null || bet.oddsAtBet == null) return 0;
  const baseWin = Math.round(bet.stake * Number(bet.oddsAtBet) * oddsBoost);
  return Math.max(0, bet.payout - baseWin);
}
