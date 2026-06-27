import "server-only";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { bets, groups, matches, podiumBets, tokenLedger, tournaments } from "@/db/schema";
import { getBadge, tierFor } from "@/lib/badges/catalog";
import type { BadgeProgress, ScoredBet } from "@/lib/badges/evaluate";
import { computeAbsoluteMatchBadges, computePerfectDays, diffBadge } from "@/lib/badges/evaluate";
import { currentLeader, roundWinners, tournamentPlacements } from "@/lib/badges/relative";
import type { BadgeIncrement } from "@/lib/notifications";
import { createBadgeNotifications } from "@/lib/notifications";
import {
  countBadgeEvents,
  loadUserBadges,
  recordBadgeEvent,
  upsertUserBadge,
} from "@/queries/badges";
import { getGroupLeaderboard } from "@/queries/leaderboard";

// ──────────────────────── private helpers ────────────────────────

async function getOfficialGroup(tournamentId: string) {
  return db.query.groups.findFirst({
    where: and(eq(groups.tournamentId, tournamentId), eq(groups.isOfficial, true)),
  });
}

async function loadUserOfficialScoredBets(
  userId: string,
  officialGroupId: string,
): Promise<ScoredBet[]> {
  const rows = await db
    .select({
      matchId: bets.matchId,
      scheduledAt: matches.scheduledAt,
      result1x2Correct: bets.result1x2Correct,
      exactScoreCorrect: bets.exactScoreCorrect,
      oddsAtBet: bets.oddsAtBet,
      stake: bets.stake,
    })
    .from(bets)
    .innerJoin(matches, eq(bets.matchId, matches.id))
    .where(and(eq(bets.groupId, officialGroupId), eq(bets.userId, userId), isNotNull(bets.payout)))
    .orderBy(matches.scheduledAt, bets.matchId);

  return rows.map((r) => ({
    matchId: r.matchId,
    scheduledAt: r.scheduledAt,
    result1x2Correct: r.result1x2Correct ?? false,
    exactScoreCorrect: r.exactScoreCorrect ?? false,
    oddsAtBet: r.oddsAtBet != null ? Number(r.oddsAtBet) : null,
    stake: r.stake,
  }));
}

/**
 * Process one event-gated badge for a batch of users.
 * Loads each user's stored badge BEFORE upsert so we can compare old vs. new tier.
 */
async function processEventBadgeForUsers(
  badgeKey: string,
  userIds: string[],
  eventKey: string,
): Promise<void> {
  const def = getBadge(badgeKey);
  if (!def) return;

  for (const userId of userIds) {
    const storedBadges = await loadUserBadges(userId);
    const oldTier = storedBadges.get(badgeKey)?.tier ?? 0;

    const isNew = await recordBadgeEvent(userId, badgeKey, eventKey);
    if (!isNew) continue; // already recorded in a previous run — idempotent

    const count = await countBadgeEvents(userId, badgeKey);
    const tier = tierFor(def, count);

    await upsertUserBadge(userId, { badgeKey, tier, value: count, count, bestValue: null });

    if (tier > oldTier) {
      const increment: BadgeIncrement = {
        badgeKey,
        tier,
        count,
        bestValue: null,
        change: oldTier === 0 ? "new" : "upgraded",
      };
      await createBadgeNotifications(userId, [increment]);
    }
  }
}

// ──────────────────────── isRoundComplete ────────────────────────

/**
 * Returns true when there are no scheduled or live matches for the given
 * (tournamentId, round) pair — i.e. the round is fully settled.
 */
export async function isRoundComplete(tournamentId: string, round: string): Promise<boolean> {
  try {
    const pending = await db.query.matches.findFirst({
      where: and(
        eq(matches.tournamentId, tournamentId),
        eq(matches.round, round),
        inArray(matches.status, ["scheduled", "live"]),
      ),
      columns: { id: true },
    });
    return !pending;
  } catch (err) {
    console.error("[badges] isRoundComplete failed", err);
    return false;
  }
}

// ──────────────────────── evaluateMatchBadges ────────────────────────

/**
 * Called after a match is scored. Evaluates absolute per-match badges
 * (win_streak, exact_streak, jackpot) for every user who placed a scored
 * bet on this match in the official Ranglista group.
 *
 * Never throws — badge failures must not break the scoring flow.
 */
export async function evaluateMatchBadges(matchId: string): Promise<void> {
  try {
    const match = await db.query.matches.findFirst({
      where: eq(matches.id, matchId),
      columns: { tournamentId: true },
    });
    if (!match) return;

    const officialGroup = await getOfficialGroup(match.tournamentId);
    if (!officialGroup) return;

    // Only users whose bet on this specific match is already scored
    const betRows = await db
      .select({ userId: bets.userId })
      .from(bets)
      .where(
        and(eq(bets.matchId, matchId), eq(bets.groupId, officialGroup.id), isNotNull(bets.payout)),
      );
    const userIds = [...new Set(betRows.map((b) => b.userId))];
    if (userIds.length === 0) return;

    for (const userId of userIds) {
      const [storedBadges, scoredBets] = await Promise.all([
        loadUserBadges(userId),
        loadUserOfficialScoredBets(userId, officialGroup.id),
      ]);

      const derived = computeAbsoluteMatchBadges(scoredBets);
      const increments: BadgeIncrement[] = [];

      for (const progress of derived) {
        const diff = diffBadge(storedBadges.get(progress.badgeKey), progress);
        if (diff) {
          increments.push({
            badgeKey: progress.badgeKey,
            tier: progress.tier,
            count: progress.count,
            bestValue: progress.bestValue,
            change: diff,
          });
        }
        // ALWAYS upsert — keeps count/bestValue up to date even without a tier change
        await upsertUserBadge(userId, progress);
      }

      if (increments.length > 0) {
        await createBadgeNotifications(userId, increments);
      }
    }
  } catch (err) {
    console.error("[badges] evaluateMatchBadges failed", { matchId, err });
  }
}

// ──────────────────────── evaluateRoundBadges ────────────────────────

/**
 * Called after a round is complete (all matches scored). Evaluates:
 *   - perfect_day  (absolute: full round where every scored match was correct)
 *   - round_winner (relative: highest net token gain for the round)
 *   - throne       (relative: current overall leaderboard leader)
 *
 * Never throws — badge failures must not break the scoring flow.
 */
export async function evaluateRoundBadges(tournamentId: string, round: string): Promise<void> {
  try {
    const officialGroup = await getOfficialGroup(tournamentId);
    if (!officialGroup) return;
    const officialGroupId = officialGroup.id;

    // ── 1. perfect_day ──────────────────────────────────────────────
    const pdDef = getBadge("perfect_day");
    if (pdDef) {
      // Users who have at least one scored bet in this round (official group)
      const roundBetUsers = await db
        .selectDistinct({ userId: bets.userId })
        .from(bets)
        .innerJoin(matches, eq(bets.matchId, matches.id))
        .where(
          and(eq(bets.groupId, officialGroupId), eq(matches.round, round), isNotNull(bets.payout)),
        );

      for (const { userId } of roundBetUsers) {
        // perfect_day counts across ALL scored official bets, not just this round
        const [storedBadges, scoredBets] = await Promise.all([
          loadUserBadges(userId),
          loadUserOfficialScoredBets(userId, officialGroupId),
        ]);

        const count = computePerfectDays(scoredBets);
        const progress: BadgeProgress = {
          badgeKey: "perfect_day",
          tier: tierFor(pdDef, count),
          value: count,
          count,
          bestValue: null,
        };

        const diff = diffBadge(storedBadges.get("perfect_day"), progress);
        await upsertUserBadge(userId, progress);

        if (diff) {
          await createBadgeNotifications(userId, [
            {
              badgeKey: "perfect_day",
              tier: progress.tier,
              count: progress.count,
              bestValue: null,
              change: diff,
            },
          ]);
        }
      }
    }

    // ── 2. round_winner ─────────────────────────────────────────────
    // Sum tokenLedger amounts (bet=negative, win/refund=positive) per user
    // for ledger entries whose reference bet belongs to this round.
    const netRows = await db
      .select({
        userId: tokenLedger.userId,
        net: sql<number>`SUM(${tokenLedger.amount})`,
      })
      .from(tokenLedger)
      .innerJoin(bets, eq(tokenLedger.referenceId, bets.id))
      .innerJoin(matches, eq(bets.matchId, matches.id))
      .where(
        and(
          eq(tokenLedger.groupId, officialGroupId),
          eq(matches.round, round),
          inArray(tokenLedger.type, ["bet", "win", "refund"]),
        ),
      )
      .groupBy(tokenLedger.userId);

    const winners = roundWinners(netRows.map((r) => ({ userId: r.userId, net: Number(r.net) })));
    await processEventBadgeForUsers("round_winner", winners, `${tournamentId}:${round}`);

    // ── 3. throne ───────────────────────────────────────────────────
    const thDef = getBadge("throne");
    if (thDef) {
      const leaderboardRows = await getGroupLeaderboard(officialGroupId);
      const ranking = leaderboardRows.map((r) => ({
        userId: r.userId,
        profit: r.profit,
        rank: r.rank,
      }));
      const leaderId = currentLeader(ranking);

      if (leaderId) {
        await processEventBadgeForUsers("throne", [leaderId], tournamentId);
      }
    }
  } catch (err) {
    console.error("[badges] evaluateRoundBadges failed", { tournamentId, round, err });
  }
}

// ──────────────────────── evaluateTournamentBadges ────────────────────────

/**
 * Called after a tournament ends. Evaluates:
 *   - champion    (1st place on the final official leaderboard)
 *   - podium      (top 3 on the final official leaderboard)
 *   - red_lantern (last place on the final official leaderboard)
 *   - oracle      (predicted ≥1 exact podium position in podium_bets)
 *
 * Never throws — badge failures must not break the scoring flow.
 */
export async function evaluateTournamentBadges(tournamentId: string): Promise<void> {
  try {
    const officialGroup = await getOfficialGroup(tournamentId);
    if (!officialGroup) return;
    const officialGroupId = officialGroup.id;

    const leaderboardRows = await getGroupLeaderboard(officialGroupId);
    if (leaderboardRows.length === 0) return;

    const ranking = leaderboardRows.map((r) => ({
      userId: r.userId,
      profit: r.profit,
      rank: r.rank,
    }));

    const { champions, podium, lastPlace } = tournamentPlacements(ranking);

    await processEventBadgeForUsers("champion", champions, tournamentId);
    await processEventBadgeForUsers("podium", podium, tournamentId);
    await processEventBadgeForUsers("red_lantern", lastPlace, tournamentId);

    // ── oracle ──────────────────────────────────────────────────────
    const oracleDef = getBadge("oracle");
    if (!oracleDef) return;

    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
      columns: { goldTeamId: true, silverTeamId: true, bronzeTeamId: true },
    });
    // Can't evaluate oracle without confirmed podium results
    if (!tournament?.goldTeamId || !tournament?.silverTeamId || !tournament?.bronzeTeamId) return;

    const { goldTeamId, silverTeamId, bronzeTeamId } = tournament;

    const allPodiumBets = await db.query.podiumBets.findMany({
      where: eq(podiumBets.tournamentId, tournamentId),
    });

    for (const pb of allPodiumBets) {
      let exactHits = 0;
      if (pb.goldTeamId === goldTeamId) exactHits++;
      if (pb.silverTeamId === silverTeamId) exactHits++;
      if (pb.bronzeTeamId === bronzeTeamId) exactHits++;
      if (exactHits === 0) continue;

      await processEventBadgeForUsers("oracle", [pb.userId], tournamentId);
    }
  } catch (err) {
    console.error("[badges] evaluateTournamentBadges failed", { tournamentId, err });
  }
}
