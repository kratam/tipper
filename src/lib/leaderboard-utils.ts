export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  profit: number;
}

export function pickMiniLeaderboard(
  leaderboard: readonly LeaderboardEntry[],
  currentUserId: string,
  size = 3,
): LeaderboardEntry[] {
  if (leaderboard.length === 0) return [];

  const userIndex = leaderboard.findIndex((e) => e.userId === currentUserId);

  // User not found or already in top `size` → return top `size`
  if (userIndex === -1 || userIndex < size) {
    return leaderboard.slice(0, size);
  }

  // User is below `size` → [top (size-2), person ahead, me]
  const topCount = Math.max(0, size - 2);
  const top = leaderboard.slice(0, topCount);
  const ahead = leaderboard[userIndex - 1];
  const me = leaderboard[userIndex];

  return [...top, ahead, me];
}

export interface CuratedRows<T> {
  leaders: T[];
  around: T[];
  hiddenCount: number;
}

/**
 * Kurált sorok a landing tip-mátrixhoz: leaderek (top N) + a user ±M környezete.
 * A `hiddenCount` a rés mérete (a leaderek és az around közt + az around alatt rejtett sorok).
 */
export function splitCuratedRows<T extends { userId: string }>(
  rows: readonly T[],
  currentUserId: string,
  opts: { leaders?: number; neighbors?: number } = {},
): CuratedRows<T> {
  const leaderCount = opts.leaders ?? 3;
  const neighbors = opts.neighbors ?? 1;
  const leaders = rows.slice(0, leaderCount);

  const userIndex = rows.findIndex((r) => r.userId === currentUserId);
  if (userIndex === -1 || userIndex < leaderCount) {
    return { leaders, around: [], hiddenCount: Math.max(0, rows.length - leaders.length) };
  }

  const start = Math.max(leaderCount, userIndex - neighbors);
  const end = Math.min(rows.length - 1, userIndex + neighbors);
  const around = rows.slice(start, end + 1);
  return { leaders, around, hiddenCount: rows.length - leaders.length - around.length };
}
