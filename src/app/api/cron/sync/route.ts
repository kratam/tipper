import { and, eq, isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { bets, groups, matches, matchOdds, teams, tokenLedger, tournaments } from "@/db/schema";
import {
  extract3WayOdds,
  fetchGames,
  fetchOdds,
  mapApiStatus,
  parseRegulationScore,
} from "@/lib/api-sports";
import { calculateBetPayout } from "@/lib/scoring";
import { calculateCarryover, getRelevantOdds } from "@/lib/tokens";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeTournaments = await db.query.tournaments.findMany({
    where: eq(tournaments.status, "active"),
  });

  // Smart cron: only call API when there's a reason to
  const shouldCallApi = await checkShouldCallApi();

  let apiSynced = 0;
  if (shouldCallApi) {
    for (const tournament of activeTournaments) {
      await syncTournament(tournament);
    }
    apiSynced = activeTournaments.length;
  }

  // Token distribution always runs (cheap, DB-only)
  for (const tournament of activeTournaments) {
    await distributeTokensForTournament(tournament.id);
  }

  return NextResponse.json({
    ok: true,
    apiSynced,
    skippedApi: !shouldCallApi,
    tokenDistribution: activeTournaments.length,
  });
}

const NEAR_START_WINDOW_MS = 15 * 60 * 1000; // ±15 min
const NEAR_END_WINDOW_MS = 30 * 60 * 1000; // ±30 min
const STALE_SYNC_MS = 6 * 60 * 60 * 1000; // 6 hours

async function checkShouldCallApi(): Promise<boolean> {
  const now = new Date();

  // Any live matches?
  const liveCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(matches)
    .where(eq(matches.status, "live"));
  if (Number(liveCount[0].count) > 0) return true;

  // Any match starting soon? (scheduled_at within ±15 min of now)
  const nearStartCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(matches)
    .where(
      and(
        eq(matches.status, "scheduled"),
        sql`${matches.scheduledAt} >= ${new Date(now.getTime() - NEAR_START_WINDOW_MS)}`,
        sql`${matches.scheduledAt} <= ${new Date(now.getTime() + NEAR_START_WINDOW_MS)}`,
      ),
    );
  if (Number(nearStartCount[0].count) > 0) return true;

  // Any match ending soon? (scheduled_at + 3h within ±30 min of now)
  const nearEndCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(matches)
    .where(
      and(
        eq(matches.status, "scheduled"),
        sql`${matches.scheduledAt} + interval '3 hours' >= ${new Date(now.getTime() - NEAR_END_WINDOW_MS)}`,
        sql`${matches.scheduledAt} + interval '3 hours' <= ${new Date(now.getTime() + NEAR_END_WINDOW_MS)}`,
      ),
    );
  if (Number(nearEndCount[0].count) > 0) return true;

  // Last odds sync was more than 6 hours ago?
  const lastSync = await db.query.matchOdds.findFirst({
    orderBy: (odds, { desc }) => [desc(odds.fetchedAt)],
  });
  if (!lastSync || now.getTime() - lastSync.fetchedAt.getTime() > STALE_SYNC_MS) return true;

  return false;
}

type Tournament = {
  id: string;
  apiLeagueId: number;
  apiSeason: number;
};

async function syncTournament(tournament: Tournament): Promise<void> {
  const games = await fetchGames(tournament.apiLeagueId, tournament.apiSeason);

  for (const game of games) {
    // Upsert home team
    const homeTeamId = await upsertTeam(
      game.teams.home.id,
      game.teams.home.name,
      game.teams.home.logo,
    );
    // Upsert away team
    const awayTeamId = await upsertTeam(
      game.teams.away.id,
      game.teams.away.name,
      game.teams.away.logo,
    );

    const newStatus = mapApiStatus(game.status.short);
    const regulationScore = parseRegulationScore(game.periods);

    // Check existing match
    const existingMatch = await db.query.matches.findFirst({
      where: eq(matches.apiGameId, game.id),
    });

    if (existingMatch) {
      const wasFinished = existingMatch.status === "finished";
      const wasCancelled = existingMatch.status === "cancelled";

      await db
        .update(matches)
        .set({
          status: newStatus,
          homeScore: newStatus === "finished" ? regulationScore.home : game.scores.home,
          awayScore: newStatus === "finished" ? regulationScore.away : game.scores.away,
          updatedAt: new Date(),
        })
        .where(eq(matches.id, existingMatch.id));

      if (!wasFinished && newStatus === "finished") {
        await scoreMatch(existingMatch.id, regulationScore.home, regulationScore.away);
      }

      if (!wasCancelled && newStatus === "cancelled") {
        await refundMatch(existingMatch.id);
      }
    } else {
      await db.insert(matches).values({
        tournamentId: tournament.id,
        apiGameId: game.id,
        homeTeamId,
        awayTeamId,
        homeScore: newStatus === "finished" ? regulationScore.home : game.scores.home,
        awayScore: newStatus === "finished" ? regulationScore.away : game.scores.away,
        status: newStatus,
        scheduledAt: new Date(game.date),
        round: new Date(game.date).toISOString().split("T")[0],
      });
    }
  }

  // Sync odds
  const oddsGames = await fetchOdds(tournament.apiLeagueId, tournament.apiSeason);

  for (const oddsGame of oddsGames) {
    const threeWay = extract3WayOdds(oddsGame);
    if (!threeWay) continue;

    // Find matching scheduled match
    const match = await db.query.matches.findFirst({
      where: and(eq(matches.apiGameId, oddsGame.game.id), eq(matches.status, "scheduled")),
    });
    if (!match) continue;

    // Insert new odds
    await db.insert(matchOdds).values({
      matchId: match.id,
      homeOdds: threeWay.homeOdds,
      drawOdds: threeWay.drawOdds,
      awayOdds: threeWay.awayOdds,
    });

    // Fill NULL odds_at_bet for bets on this match that don't have odds yet
    const betsWithoutOdds = await db.query.bets.findMany({
      where: and(eq(bets.matchId, match.id), isNull(bets.oddsAtBet)),
    });

    for (const bet of betsWithoutOdds) {
      const relevantOdds = getRelevantOdds(bet.predictedHome, bet.predictedAway, threeWay);
      await db
        .update(bets)
        .set({ oddsAtBet: String(relevantOdds), updatedAt: new Date() })
        .where(eq(bets.id, bet.id));
    }
  }
}

async function upsertTeam(apiTeamId: number, name: string, logoUrl: string): Promise<string> {
  const [team] = await db
    .insert(teams)
    .values({ apiTeamId, name, logoUrl })
    .onConflictDoUpdate({
      target: teams.apiTeamId,
      set: { name, logoUrl },
    })
    .returning({ id: teams.id });

  return team.id;
}

async function scoreMatch(matchId: string, homeScore: number, awayScore: number): Promise<void> {
  // Find all bets for this match where payout IS NULL
  const pendingBets = await db.query.bets.findMany({
    where: and(eq(bets.matchId, matchId), isNull(bets.payout)),
    with: { group: true },
  });

  for (const bet of pendingBets) {
    const oddsAtBet = bet.oddsAtBet ? Number.parseFloat(bet.oddsAtBet) : null;
    const result = calculateBetPayout({
      predictedHome: bet.predictedHome,
      predictedAway: bet.predictedAway,
      actualHome: homeScore,
      actualAway: awayScore,
      stake: bet.stake,
      oddsAtBet,
      groupSettings: {
        bonusGoalDiff: bet.group.bonusGoalDiff,
        bonusExactScore: bet.group.bonusExactScore,
      },
    });

    await db
      .update(bets)
      .set({
        payout: result.payout,
        result1x2Correct: result.result1x2Correct,
        goalDiffCorrect: result.goalDiffCorrect,
        exactScoreCorrect: result.exactScoreCorrect,
        updatedAt: new Date(),
      })
      .where(eq(bets.id, bet.id));

    if (result.payout > 0) {
      // Look up tournament via group
      const group = await db.query.groups.findFirst({
        where: eq(groups.id, bet.groupId),
      });
      if (!group) continue;

      await db.insert(tokenLedger).values({
        userId: bet.userId,
        groupId: bet.groupId,
        tournamentId: group.tournamentId,
        amount: result.payout,
        type: "win",
        referenceId: bet.id,
      });
    }
  }
}

async function refundMatch(matchId: string): Promise<void> {
  const matchBets = await db.query.bets.findMany({
    where: eq(bets.matchId, matchId),
    with: { group: true },
  });

  for (const bet of matchBets) {
    await db.insert(tokenLedger).values({
      userId: bet.userId,
      groupId: bet.groupId,
      tournamentId: bet.group.tournamentId,
      amount: bet.stake,
      type: "refund",
      referenceId: bet.id,
    });
  }
}

/**
 * Distribute tokens for all groups in a tournament for today's round.
 * A "round" is a match day (YYYY-MM-DD string from matches.round).
 * Idempotent: checks if distribution already happened for each (user, group, round).
 */
async function distributeTokensForTournament(tournamentId: string): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  // Find today's rounds for this tournament
  const todayMatches = await db.query.matches.findMany({
    where: and(eq(matches.tournamentId, tournamentId), eq(matches.round, today)),
  });

  if (todayMatches.length === 0) return;

  // Get all groups for this tournament
  const tournamentGroups = await db.query.groups.findMany({
    where: eq(groups.tournamentId, tournamentId),
    with: { members: true },
  });

  for (const group of tournamentGroups) {
    for (const member of group.members) {
      // Check if distribution already exists for this round
      // We use a convention: type=distribution entries for a round have
      // no referenceId, so we check by (userId, groupId, type=distribution, createdAt on today)
      const existing = await db
        .select({ count: sql<number>`count(*)` })
        .from(tokenLedger)
        .where(
          and(
            eq(tokenLedger.userId, member.userId),
            eq(tokenLedger.groupId, group.id),
            eq(tokenLedger.type, "distribution"),
            sql`${tokenLedger.createdAt}::date = ${today}::date`,
          ),
        );

      if (Number(existing[0].count) > 0) continue;

      // Calculate carryover from previous round
      const previousRounds = await db
        .selectDistinct({ round: matches.round })
        .from(matches)
        .where(and(eq(matches.tournamentId, tournamentId), sql`${matches.round} < ${today}`))
        .orderBy(sql`${matches.round} desc`)
        .limit(1);

      let carryoverAmount = 0;
      if (previousRounds.length > 0) {
        // Get user's balance in this group (total ledger sum)
        const balanceResult = await db
          .select({ balance: sql<number>`COALESCE(SUM(${tokenLedger.amount}), 0)` })
          .from(tokenLedger)
          .where(and(eq(tokenLedger.userId, member.userId), eq(tokenLedger.groupId, group.id)));
        const currentBalance = Number(balanceResult[0].balance);

        // Carryover is based on unused tokens (current balance = unused from prev rounds)
        if (currentBalance > 0) {
          carryoverAmount = calculateCarryover(currentBalance, group.carryoverPercent);
        }
      }

      // Distribute base tokens
      await db.insert(tokenLedger).values({
        userId: member.userId,
        groupId: group.id,
        tournamentId,
        amount: group.tokenPerRound,
        type: "distribution",
      });

      // Add carryover if applicable
      if (carryoverAmount > 0) {
        await db.insert(tokenLedger).values({
          userId: member.userId,
          groupId: group.id,
          tournamentId,
          amount: carryoverAmount,
          type: "carryover",
        });
      }
    }
  }
}
