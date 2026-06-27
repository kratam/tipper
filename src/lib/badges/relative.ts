export interface RankRow {
  userId: string;
  profit: number;
  rank: number;
}

const MIN_FIELD = 3;

export function roundWinners(netByUser: { userId: string; net: number }[]): string[] {
  if (netByUser.length === 0) return [];
  const max = Math.max(...netByUser.map((r) => r.net));
  if (max <= 0) return [];
  return netByUser.filter((r) => r.net === max).map((r) => r.userId);
}

export function tournamentPlacements(ranking: RankRow[]): {
  champions: string[];
  podium: string[];
  lastPlace: string[];
} {
  if (ranking.length < MIN_FIELD) return { champions: [], podium: [], lastPlace: [] };
  const maxRank = Math.max(...ranking.map((r) => r.rank));
  return {
    champions: ranking.filter((r) => r.rank === 1).map((r) => r.userId),
    podium: ranking.filter((r) => r.rank <= 3).map((r) => r.userId),
    lastPlace: ranking.filter((r) => r.rank === maxRank).map((r) => r.userId),
  };
}

export function currentLeader(ranking: RankRow[]): string | null {
  if (ranking.length < MIN_FIELD) return null;
  return ranking.find((r) => r.rank === 1)?.userId ?? null;
}
