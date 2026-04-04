"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bets, matches } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { getGroupLeaderboard } from "@/queries/leaderboard";

// ── Types ──

export interface LiveBetData {
  betId: string;
  matchId: string;
  result1x2Correct: boolean | null;
  goalDiffCorrect: boolean | null;
  exactScoreCorrect: boolean | null;
  payout: number | null;
}

export interface LiveMatchData {
  matchId: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  userBets: LiveBetData[];
}

export interface LiveLeaderboardRow {
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  balance: number;
  rank: number;
}

// ── Actions ──

export async function getLiveMatchData(tournamentId: string): Promise<LiveMatchData[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const [tournamentMatches, userBets] = await Promise.all([
    db
      .select({
        id: matches.id,
        homeScore: matches.homeScore,
        awayScore: matches.awayScore,
        status: matches.status,
      })
      .from(matches)
      .where(eq(matches.tournamentId, tournamentId)),
    db.query.bets.findMany({
      where: eq(bets.userId, user.id),
      with: { match: true },
    }),
  ]);

  const betsByMatch = new Map<string, (typeof userBets)[number][]>();
  for (const bet of userBets) {
    if (bet.match.tournamentId !== tournamentId) continue;
    const existing = betsByMatch.get(bet.matchId) ?? [];
    betsByMatch.set(bet.matchId, [...existing, bet]);
  }

  return tournamentMatches.map((m) => ({
    matchId: m.id,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    status: m.status,
    userBets: (betsByMatch.get(m.id) ?? []).map((b) => ({
      betId: b.id,
      matchId: b.matchId,
      result1x2Correct: b.result1x2Correct,
      goalDiffCorrect: b.goalDiffCorrect,
      exactScoreCorrect: b.exactScoreCorrect,
      payout: b.payout,
    })),
  }));
}

export async function getLiveLeaderboard(groupId: string): Promise<LiveLeaderboardRow[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  return getGroupLeaderboard(groupId);
}
