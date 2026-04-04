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
): LeaderboardEntry[] {
  if (leaderboard.length === 0) return [];

  const userIndex = leaderboard.findIndex((e) => e.userId === currentUserId);

  // User not found or in top 3 → return top 3
  if (userIndex === -1 || userIndex < 3) {
    return leaderboard.slice(0, 3);
  }

  // User is 4th or lower → [1st, person ahead, me]
  const first = leaderboard[0];
  const ahead = leaderboard[userIndex - 1];
  const me = leaderboard[userIndex];

  return [first, ahead, me];
}
