"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bets, groupMembers, groups, matches, tokenLedger } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { getRelevantOdds } from "@/lib/tokens";
import { getProjectedBalance } from "@/queries/groups";
import { getLatestOdds } from "@/queries/matches";

interface PlaceBetInput {
  matchId: string;
  groupId: string;
  predictedHome: number;
  predictedAway: number;
  stake: number;
}

type ActionResult = { success: true } | { success: false; error: string };

export async function placeBet(input: PlaceBetInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { matchId, groupId, predictedHome, predictedAway, stake } = input;

  // Verify membership
  const membership = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)),
  });
  if (!membership) return { success: false, error: "Not a member of this group" };

  // Verify match is scheduled and hasn't started
  const matchRow = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
  });
  if (!matchRow) return { success: false, error: "Match not found" };
  if (matchRow.status !== "scheduled")
    return { success: false, error: "Match already started or finished" };
  if (matchRow.scheduledAt <= new Date())
    return { success: false, error: "Match has already started" };

  // Get group info for tournamentId
  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
  });
  if (!group) return { success: false, error: "Group not found" };

  // Get latest odds
  const latestOdds = await getLatestOdds(matchId);
  const oddsAtBet = latestOdds
    ? String(getRelevantOdds(predictedHome, predictedAway, latestOdds))
    : null;

  // Check for existing bet
  const existingBet = await db.query.bets.findFirst({
    where: and(eq(bets.userId, user.id), eq(bets.matchId, matchId), eq(bets.groupId, groupId)),
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

    // Check projected balance after refund
    const { projected: projectedAfterRefund } = await getProjectedBalance(
      user.id,
      groupId,
      matchId,
    );
    if (projectedAfterRefund < stake)
      return { success: false, error: "Insufficient token balance" };

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

    return { success: true };
  }

  // New bet — check projected balance
  const { projected } = await getProjectedBalance(user.id, groupId, matchId);
  if (projected < stake) return { success: false, error: "Insufficient token balance" };

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

  return { success: true };
}

export async function cancelBet(betId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const bet = await db.query.bets.findFirst({
    where: eq(bets.id, betId),
    with: { match: true, group: true },
  });
  if (!bet) return { success: false, error: "Bet not found" };
  if (bet.userId !== user.id) return { success: false, error: "Unauthorized" };
  if (bet.match.scheduledAt <= new Date())
    return { success: false, error: "Match has already started" };

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
  return { success: true };
}
