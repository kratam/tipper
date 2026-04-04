export function isScheduleBroken(dates: Date[]): boolean {
  if (dates.length < 2) return false;

  const dayCounts = new Map<string, number>();
  for (const d of dates) {
    const key = d.toISOString().split("T")[0];
    dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
  }

  const maxCount = Math.max(...dayCounts.values());
  return maxCount / dates.length > 0.8;
}

export interface DatePair {
  apiDate: Date;
  overrideDate: Date;
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export function hasApiScheduleImproved(pairs: DatePair[]): boolean {
  if (pairs.length === 0) return false;

  const matchingCount = pairs.filter(
    ({ apiDate, overrideDate }) =>
      Math.abs(apiDate.getTime() - overrideDate.getTime()) <= TWO_HOURS_MS,
  ).length;

  return matchingCount / pairs.length >= 0.9;
}
