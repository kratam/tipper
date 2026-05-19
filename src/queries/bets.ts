import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { bets, groupMembers } from "@/db/schema";

export async function getUserBetsForMatch(userId: string, matchId: string) {
  return db.query.bets.findMany({
    where: and(eq(bets.userId, userId), eq(bets.matchId, matchId)),
    with: {
      group: true,
    },
  });
}

export interface GroupMemberBet {
  betId: string;
  userId: string;
  userName: string;
  userDisplayName: string | null;
  userAvatarUrl: string | null;
  predictedHome: number;
  predictedAway: number;
  stake: number;
  result1x2Correct: boolean | null;
  payout: number | null;
}

export interface GroupBetsForMatch {
  groupId: string;
  groupName: string;
  bets: GroupMemberBet[];
}

/**
 * Returns all bets on a match grouped by the groups the given user is a member of.
 * Groups with zero bets on the match are still included (empty `bets`) so the UI
 * can render a "nobody tipped" hint.
 */
export async function getGroupBetsForStartedMatch(
  userId: string,
  matchId: string,
): Promise<GroupBetsForMatch[]> {
  const myGroups = await db.query.groupMembers.findMany({
    where: eq(groupMembers.userId, userId),
    with: { group: true },
  });

  if (myGroups.length === 0) return [];

  const groupIds = myGroups.map((m) => m.groupId);

  const matchBets = await db.query.bets.findMany({
    where: and(eq(bets.matchId, matchId), inArray(bets.groupId, groupIds)),
    with: { user: true },
  });

  const betsByGroup = new Map<string, GroupMemberBet[]>();
  for (const bet of matchBets) {
    const existing = betsByGroup.get(bet.groupId) ?? [];
    existing.push({
      betId: bet.id,
      userId: bet.userId,
      userName: bet.user.name,
      userDisplayName: bet.user.displayName,
      userAvatarUrl: bet.user.avatarUrl,
      predictedHome: bet.predictedHome,
      predictedAway: bet.predictedAway,
      stake: bet.stake,
      result1x2Correct: bet.result1x2Correct,
      payout: bet.payout,
    });
    betsByGroup.set(bet.groupId, existing);
  }

  return myGroups
    .map((m) => ({
      groupId: m.groupId,
      groupName: m.group.name,
      bets: betsByGroup.get(m.groupId) ?? [],
    }))
    .filter((g) => g.bets.length > 0);
}

export async function getGroupBetsForFinishedMatches(groupId: string) {
  return db.query.bets
    .findMany({
      where: eq(bets.groupId, groupId),
      with: {
        user: true,
        match: true,
      },
    })
    .then((allBets) => allBets.filter((bet) => bet.match.status === "finished"));
}

export async function getUserBetsForTournament(userId: string, tournamentId: string) {
  return db.query.bets
    .findMany({
      where: eq(bets.userId, userId),
      with: {
        match: {
          with: {
            homeTeam: true,
            awayTeam: true,
            tournament: true,
          },
        },
        group: true,
      },
    })
    .then((allBets) => allBets.filter((bet) => bet.match.tournamentId === tournamentId));
}
