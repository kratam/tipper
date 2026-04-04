import { and, eq, isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  bets,
  groups,
  matches,
  matchOdds,
  matchScheduleOverrides,
  teams,
  tokenLedger,
  tournaments,
} from "@/db/schema";
import {
  extract3WayOdds,
  fetchGames,
  fetchOdds,
  mapApiStatus,
  parseRegulationScore,
} from "@/lib/api-sports";
import { hasApiScheduleImproved, isScheduleBroken } from "@/lib/schedule-override";
import { calculateBetPayout } from "@/lib/scoring";
import { getRelevantOdds } from "@/lib/tokens";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeTournaments = await db.query.tournaments.findMany({
    where: eq(tournaments.status, "active"),
  });

  const upcomingTournaments = await db.query.tournaments.findMany({
    where: eq(tournaments.status, "upcoming"),
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

  // Upcoming tournaments: sync fixtures + overrides on stale schedule (6h)
  let upcomingSynced = 0;
  if (await isStaleSync()) {
    for (const tournament of upcomingTournaments) {
      await syncTournament(tournament);
    }
    upcomingSynced = upcomingTournaments.length;
  }

  // Token distribution always runs (cheap, DB-only) — active only
  for (const tournament of activeTournaments) {
    await distributeTokensForTournament(tournament.id);
  }

  return NextResponse.json({
    ok: true,
    apiSynced,
    upcomingSynced,
    skippedApi: !shouldCallApi,
    tokenDistribution: activeTournaments.length,
  });
}

const NEAR_START_WINDOW_MS = 15 * 60 * 1000; // ±15 min
const NEAR_END_WINDOW_MS = 30 * 60 * 1000; // ±30 min
const STALE_SYNC_MS = 6 * 60 * 60 * 1000; // 6 hours

async function isStaleSync(): Promise<boolean> {
  const lastSync = await db.query.matchOdds.findFirst({
    orderBy: (odds, { desc }) => [desc(odds.fetchedAt)],
  });
  if (!lastSync) return true;
  return Date.now() - lastSync.fetchedAt.getTime() > STALE_SYNC_MS;
}

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
  if (await isStaleSync()) return true;

  return false;
}

type Tournament = {
  id: string;
  apiLeagueId: number;
  apiSeason: number;
  useScheduleOverrides: boolean;
};

async function syncTournament(tournament: Tournament): Promise<void> {
  const games = await fetchGames(tournament.apiLeagueId, tournament.apiSeason);

  const apiGameDates = new Map<number, string>();

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
    apiGameDates.set(game.id, game.date);
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
          scheduledAt: new Date(game.date),
          round: new Date(game.date).toISOString().split("T")[0],
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

  // Schedule override detection and application
  await handleScheduleOverrides(
    { id: tournament.id, useScheduleOverrides: tournament.useScheduleOverrides },
    apiGameDates,
  );
}

/**
 * Detect broken schedules and apply overrides.
 *
 * Flow:
 * 1. Check if overrides exist for this tournament
 * 2. If flag is off: detect broken schedule (>80% on same day) → turn on
 * 3. If flag is on: detect API improvement (≥90% match ±2h) → turn off
 * 4. If flag is on: overwrite matches.scheduledAt + round from overrides
 */
async function handleScheduleOverrides(
  tournament: { id: string; useScheduleOverrides: boolean },
  apiGameDates: Map<number, string>,
): Promise<void> {
  // 1. Load overrides for this tournament's matches
  const overrides = await db
    .select({
      matchId: matchScheduleOverrides.matchId,
      overrideScheduledAt: matchScheduleOverrides.scheduledAt,
      apiGameId: matches.apiGameId,
    })
    .from(matchScheduleOverrides)
    .innerJoin(matches, eq(matchScheduleOverrides.matchId, matches.id))
    .where(eq(matches.tournamentId, tournament.id));

  if (overrides.length === 0) return;

  // 2. Load current match dates for detection
  const tournamentMatches = await db.query.matches.findMany({
    where: eq(matches.tournamentId, tournament.id),
  });

  let useOverrides = tournament.useScheduleOverrides;

  if (!useOverrides) {
    // Detect broken schedule: >80% on the same day
    const scheduledDates = tournamentMatches
      .filter((m) => m.status === "scheduled")
      .map((m) => m.scheduledAt);

    if (isScheduleBroken(scheduledDates)) {
      useOverrides = true;
      await db
        .update(tournaments)
        .set({ useScheduleOverrides: true })
        .where(eq(tournaments.id, tournament.id));
    }
  } else {
    // Detect API improvement: ≥90% match within ±2h
    const pairs: { apiDate: Date; overrideDate: Date }[] = [];
    for (const o of overrides) {
      const apiDateStr = apiGameDates.get(o.apiGameId);
      if (apiDateStr) {
        pairs.push({ apiDate: new Date(apiDateStr), overrideDate: o.overrideScheduledAt });
      }
    }

    if (pairs.length > 0 && hasApiScheduleImproved(pairs)) {
      useOverrides = false;
      await db
        .update(tournaments)
        .set({ useScheduleOverrides: false })
        .where(eq(tournaments.id, tournament.id));
    }
  }

  // 4. Apply overrides if flag is on
  if (useOverrides) {
    for (const override of overrides) {
      await db
        .update(matches)
        .set({
          scheduledAt: override.overrideScheduledAt,
          round: override.overrideScheduledAt.toISOString().split("T")[0],
          updatedAt: new Date(),
        })
        .where(eq(matches.id, override.matchId));
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
 * Distribute tokens for all groups in a tournament.
 * Per-match distribution: each member gets tokenPerMatch for each match
 * where scheduledAt - now <= distributionDaysBefore days.
 * Idempotent: checks (userId, groupId, type='distribution', referenceId=matchId).
 */
async function distributeTokensForTournament(tournamentId: string): Promise<void> {
  const now = new Date();

  const tournamentGroups = await db.query.groups.findMany({
    where: eq(groups.tournamentId, tournamentId),
    with: { members: true },
  });

  for (const group of tournamentGroups) {
    const cutoff = new Date(now.getTime() + group.distributionDaysBefore * 24 * 60 * 60 * 1000);
    const eligibleMatches = await db.query.matches.findMany({
      where: and(
        eq(matches.tournamentId, tournamentId),
        eq(matches.status, "scheduled"),
        sql`${matches.scheduledAt} <= ${cutoff}`,
      ),
    });

    for (const match of eligibleMatches) {
      for (const member of group.members) {
        const existing = await db
          .select({ count: sql<number>`count(*)` })
          .from(tokenLedger)
          .where(
            and(
              eq(tokenLedger.userId, member.userId),
              eq(tokenLedger.groupId, group.id),
              eq(tokenLedger.type, "distribution"),
              eq(tokenLedger.referenceId, match.id),
            ),
          );

        if (Number(existing[0].count) > 0) continue;

        await db.insert(tokenLedger).values({
          userId: member.userId,
          groupId: group.id,
          tournamentId,
          amount: group.tokenPerMatch,
          type: "distribution",
          referenceId: match.id,
        });
      }
    }
  }
}
