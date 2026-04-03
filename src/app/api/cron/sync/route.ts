import { and, eq, isNull } from "drizzle-orm";
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
import { getRelevantOdds } from "@/lib/tokens";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeTournaments = await db.query.tournaments.findMany({
    where: eq(tournaments.status, "active"),
  });

  for (const tournament of activeTournaments) {
    await syncTournament(tournament);
  }

  return NextResponse.json({ ok: true, synced: activeTournaments.length });
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
  const existing = await db.query.teams.findFirst({
    where: eq(teams.apiTeamId, apiTeamId),
  });

  if (existing) return existing.id;

  const [newTeam] = await db
    .insert(teams)
    .values({ apiTeamId, name, logoUrl })
    .returning({ id: teams.id });

  return newTeam.id;
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
