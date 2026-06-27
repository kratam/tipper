import { getBadge, tierFor } from "@/lib/badges/catalog";

export interface ScoredBet {
  matchId: string;
  scheduledAt: Date;
  result1x2Correct: boolean;
  exactScoreCorrect: boolean;
  oddsAtBet: number | null;
  stake: number;
}

export interface BadgeProgress {
  badgeKey: string;
  tier: 0 | 1 | 2 | 3;
  value: number;
  count: number;
  bestValue: number | null;
}

function longestRun(flags: boolean[]): number {
  let best = 0;
  let cur = 0;
  for (const f of flags) {
    cur = f ? cur + 1 : 0;
    if (cur > best) best = cur;
  }
  return best;
}

export function computeWinStreak(orderedBets: ScoredBet[]): number {
  return longestRun(orderedBets.map((b) => b.result1x2Correct));
}

export function computeExactStreak(orderedBets: ScoredBet[]): number {
  return longestRun(orderedBets.map((b) => b.exactScoreCorrect));
}

export function computeJackpot(
  bets: ScoredBet[],
  minStake: number,
): { count: number; maxOdds: number } {
  let count = 0;
  let maxOdds = 0;
  for (const b of bets) {
    if (b.result1x2Correct && b.oddsAtBet !== null && b.oddsAtBet >= 3.0 && b.stake >= minStake) {
      count++;
      if (b.oddsAtBet > maxOdds) maxOdds = b.oddsAtBet;
    }
  }
  return { count, maxOdds };
}

export function computeAbsoluteMatchBadges(orderedBets: ScoredBet[]): BadgeProgress[] {
  const out: BadgeProgress[] = [];

  const winStreak = computeWinStreak(orderedBets);
  // biome-ignore lint/style/noNonNullAssertion: badge keys are static catalog entries, always present
  const wsDef = getBadge("win_streak")!;
  out.push({
    badgeKey: "win_streak",
    tier: tierFor(wsDef, winStreak),
    value: winStreak,
    count: winStreak,
    bestValue: winStreak,
  });

  const exactStreak = computeExactStreak(orderedBets);
  // biome-ignore lint/style/noNonNullAssertion: badge keys are static catalog entries, always present
  const esDef = getBadge("exact_streak")!;
  out.push({
    badgeKey: "exact_streak",
    tier: tierFor(esDef, exactStreak),
    value: exactStreak,
    count: exactStreak,
    bestValue: exactStreak,
  });

  // biome-ignore lint/style/noNonNullAssertion: badge keys are static catalog entries, always present
  const jpDef = getBadge("jackpot")!;
  const jp = computeJackpot(orderedBets, jpDef.minStake ?? 0);
  out.push({
    badgeKey: "jackpot",
    tier: tierFor(jpDef, jp.maxOdds),
    value: jp.maxOdds,
    count: jp.count,
    bestValue: jp.maxOdds || null,
  });

  return out.filter((b) => b.tier > 0 || b.count > 0);
}
