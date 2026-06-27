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

export function computePerfectDays(bets: ScoredBet[], minBets = 4): number {
  const byDay = new Map<string, { total: number; won: number }>();
  for (const b of bets) {
    const day = b.scheduledAt.toISOString().slice(0, 10);
    const e = byDay.get(day) ?? { total: 0, won: 0 };
    e.total++;
    if (b.result1x2Correct) e.won++;
    byDay.set(day, e);
  }
  let count = 0;
  for (const { total, won } of byDay.values()) {
    if (total >= minBets && won === total) count++;
  }
  return count;
}

export interface StoredBadge {
  tier: number;
  count: number;
  bestValue: number | null;
}

export function diffBadge(
  stored: StoredBadge | undefined,
  derived: BadgeProgress,
): "new" | "upgraded" | null {
  if (!stored) return derived.tier >= 1 ? "new" : null;
  if (derived.tier > stored.tier) return "upgraded";
  return null;
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
