"use server";

import { db } from "@/db";
import { bets, groups, tokenLedger, groupMembers, matches } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { getTokenBalance } from "@/queries/groups";
import { getLatestOdds } from "@/queries/matches";
import { getRelevantOdds } from "@/lib/tokens";

interface PlaceBetInput {
  matchId: string;
  groupId: string;
  predictedHome: number;
  predictedAway: number;
  stake: number;
}

export async function placeBet(input: PlaceBetInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const { matchId, groupId, predictedHome, predictedAway, stake } = input;

  // Verify membership
  const membership = await db.query.groupMembers.findFirst({
    where: and(
      eq(groupMembers.groupId, groupId),
      eq(groupMembers.userId, user.id),
    ),
  });
  if (!membership) throw new Error("Not a member of this group");

  // Verify match is scheduled and hasn't started
  const matchRow = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
  });
  if (!matchRow) throw new Error("Match not found");
  if (matchRow.status !== "scheduled") throw new Error("Match already started or finished");
  if (matchRow.scheduledAt <= new Date()) throw new Error("Match has already started");

  // Get group info for tournamentId
  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
  });
  if (!group) throw new Error("Group not found");

  // Get latest odds
  const latestOdds = await getLatestOdds(matchId);
  const oddsAtBet = latestOdds
    ? String(getRelevantOdds(predictedHome, predictedAway, latestOdds))
    : null;

  // Check for existing bet
  const existingBet = await db.query.bets.findFirst({
    where: and(
      eq(bets.userId, user.id),
      eq(bets.matchId, matchId),
      eq(bets.groupId, groupId),
    ),
  });

  if (existingBet) {
    // Refund old stake
    await db.insert(tokenLedger).values({
      userId: user.id,
      groupId,
      tournamentId: group.tournamentId,
      amount: existingBet.stake,
      type: "refund",
      referenceId: existingBet.id,
    });

    // Check balance after refund
    const balanceAfterRefund = await getTokenBalance(user.id, groupId);
    if (balanceAfterRefund < stake) throw new Error("Insufficient token balance");

    // Deduct new stake
    await db.insert(tokenLedger).values({
      userId: user.id,
      groupId,
      tournamentId: group.tournamentId,
      amount: -stake,
      type: "bet",
      referenceId: existingBet.id,
    });

    // Update bet
    await db
      .update(bets)
      .set({
        predictedHome,
        predictedAway,
        stake,
        oddsAtBet,
        payout: null,
        result1x2Correct: null,
        goalDiffCorrect: null,
        exactScoreCorrect: null,
        updatedAt: new Date(),
      })
      .where(eq(bets.id, existingBet.id));

    return existingBet;
  }

  // New bet — check balance
  const balance = await getTokenBalance(user.id, groupId);
  if (balance < stake) throw new Error("Insufficient token balance");

  const [newBet] = await db
    .insert(bets)
    .values({
      userId: user.id,
      matchId,
      groupId,
      predictedHome,
      predictedAway,
      stake,
      oddsAtBet,
    })
    .returning();

  await db.insert(tokenLedger).values({
    userId: user.id,
    groupId,
    tournamentId: group.tournamentId,
    amount: -stake,
    type: "bet",
    referenceId: newBet.id,
  });

  return newBet;
}

export async function cancelBet(betId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const bet = await db.query.bets.findFirst({
    where: eq(bets.id, betId),
    with: { match: true, group: true },
  });
  if (!bet) throw new Error("Bet not found");
  if (bet.userId !== user.id) throw new Error("Unauthorized");
  if (bet.match.scheduledAt <= new Date()) throw new Error("Match has already started");

  // Refund stake
  await db.insert(tokenLedger).values({
    userId: user.id,
    groupId: bet.groupId,
    tournamentId: bet.group.tournamentId,
    amount: bet.stake,
    type: "refund",
    referenceId: bet.id,
  });

  await db.delete(bets).where(eq(bets.id, betId));
}
