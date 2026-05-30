export interface StakePreset {
  value: number;
  label: string;
  isPerMatch?: boolean;
}

/**
 * Caps the per-match token allowance to the bettable balance and a floor of 1.
 * The per-match value must never exceed the bettable balance and never be below 1.
 */
export function clampPerMatch(tokenPerMatch: number, balance: number): number {
  return Math.max(1, Math.min(balance, tokenPerMatch));
}

/**
 * Builds the stake chips for the bet form.
 *
 * The per-match allowance (`perMatchValue`, label `perMatchLabel`) is always the
 * first chip as long as its value is >= 1. The percentage presets (even share,
 * double share, MAX) follow it, skipping any whose value OR label already appears.
 */
export function computeStakePresets(
  balance: number,
  matchCount: number,
  perMatchValue: number,
  perMatchLabel: string,
): StakePreset[] {
  const evenShare = Math.floor(balance / matchCount);
  const doubleShare = Math.floor((balance * 2) / matchCount);
  const evenPct = Math.round(100 / matchCount);
  const doublePct = Math.min(100, evenPct * 2);
  const presets: StakePreset[] = [];
  const seenValues = new Set<number>();
  const seenLabels = new Set<string>();

  for (const { value, label, isPerMatch } of [
    { value: perMatchValue, label: perMatchLabel, isPerMatch: true },
    { value: evenShare, label: `${evenPct}%`, isPerMatch: false },
    { value: doubleShare, label: `${doublePct}%`, isPerMatch: false },
    { value: balance, label: "MAX", isPerMatch: false },
  ]) {
    if (value >= 1 && !seenValues.has(value) && !seenLabels.has(label)) {
      seenValues.add(value);
      seenLabels.add(label);
      presets.push(isPerMatch ? { value, label, isPerMatch: true } : { value, label });
    }
  }
  return presets;
}
