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
