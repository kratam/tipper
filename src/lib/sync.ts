import { and, eq, isNull, sql } from "drizzle-orm";
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
  fetchLeagueLogoUrl,
  fetchOdds,
  mapApiStatus,
  parseRegulationScore,
} from "@/lib/api-sports";
import { hasApiScheduleImproved, isScheduleBroken } from "@/lib/schedule-override";
import { calculateBetPayout } from "@/lib/scoring";
import { getRelevantOdds } from "@/lib/tokens";

// ── Types ──

export type Tournament = {
  id: string;
  apiLeagueId: number;
  apiSeason: number;
  useScheduleOverrides: boolean;
};

// ── Tournament sync ──

/** Sync fixtures (games) from API, score finished matches, refund cancelled. */
export async function syncFixtures(tournament: Tournament): Promise<Map<number, string>> {
  const games = await fetchGames(tournament.apiLeagueId, tournament.apiSeason);
  const apiGameDates = new Map<number, string>();

  for (const game of games) {
    const homeTeamId = await upsertTeam(
      game.teams.home.id,
      game.teams.home.name,
      game.teams.home.logo,
    );
    const awayTeamId = await upsertTeam(
      game.teams.away.id,
      game.teams.away.name,
      game.teams.away.logo,
    );

    const newStatus = mapApiStatus(game.status.short);
    apiGameDates.set(game.id, game.date);
    const regulationScore = parseRegulationScore(game.periods);

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

  return apiGameDates;
}

/** Sync odds from API, fill NULL oddsAtBet on existing bets. */
export async function syncOdds(tournament: Tournament): Promise<void> {
  const oddsGames = await fetchOdds(tournament.apiLeagueId, tournament.apiSeason);

  for (const oddsGame of oddsGames) {
    const threeWay = extract3WayOdds(oddsGame);
    if (!threeWay) continue;

    const match = await db.query.matches.findFirst({
      where: and(eq(matches.apiGameId, oddsGame.game.id), eq(matches.status, "scheduled")),
    });
    if (!match) continue;

    await db.insert(matchOdds).values({
      matchId: match.id,
      homeOdds: threeWay.homeOdds,
      drawOdds: threeWay.drawOdds,
      awayOdds: threeWay.awayOdds,
    });

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

/** Full tournament sync: fixtures + odds + schedule overrides. */
export async function syncTournament(tournament: Tournament): Promise<void> {
  const apiGameDates = await syncFixtures(tournament);
  await syncOdds(tournament);
  await handleScheduleOverrides(
    { id: tournament.id, useScheduleOverrides: tournament.useScheduleOverrides },
    apiGameDates,
  );
}

// ── Schedule overrides ──

async function handleScheduleOverrides(
  tournament: { id: string; useScheduleOverrides: boolean },
  apiGameDates: Map<number, string>,
): Promise<void> {
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

  const tournamentMatches = await db.query.matches.findMany({
    where: eq(matches.tournamentId, tournament.id),
  });

  let useOverrides = tournament.useScheduleOverrides;

  if (!useOverrides) {
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

// ── Token distribution ──

export async function distributeTokensForTournament(tournamentId: string): Promise<void> {
  const tournamentGroups = await db.query.groups.findMany({
    where: eq(groups.tournamentId, tournamentId),
    with: { members: true },
  });

  for (const group of tournamentGroups) {
    const eligibleMatches = await db.query.matches.findMany({
      where: and(
        eq(matches.tournamentId, tournamentId),
        eq(matches.status, "scheduled"),
        sql`DATE(${matches.scheduledAt}) <= CURRENT_DATE`,
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

// ── Logo backfill ──

export async function backfillTournamentLogos(
  tournamentList: { id: string; apiLeagueId: number; logoUrl: string | null }[],
): Promise<void> {
  for (const tournament of tournamentList) {
    if (!tournament.logoUrl) {
      const logoUrl = await fetchLeagueLogoUrl(tournament.apiLeagueId);
      if (logoUrl) {
        await db.update(tournaments).set({ logoUrl }).where(eq(tournaments.id, tournament.id));
      }
    }
  }
}

// ── Helpers ──

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
        oddsBoost: bet.group.oddsBoost,
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
