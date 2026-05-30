import { and, desc, eq, isNull, sql } from "drizzle-orm";
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
import { getProvider } from "@/lib/providers";
import type { ProviderId } from "@/lib/providers/types";
import { toProviderConfig } from "@/lib/providers/types";
import { hasApiScheduleImproved, isScheduleBroken } from "@/lib/schedule-override";
import { calculateBetPayout } from "@/lib/scoring";
import { getRelevantOdds } from "@/lib/tokens";

// ── Types ──

export type Tournament = {
  id: string;
  provider: ProviderId;
  apiLeagueId: number | null;
  apiSeason: number | null;
  providerSport: string | null;
  providerLeagueSlug: string | null;
  useScheduleOverrides: boolean;
};

// ── Tournament sync ──

/** Sync fixtures (games) from API, score finished matches, refund cancelled. */
export async function syncFixtures(tournament: Tournament): Promise<Map<string, string>> {
  const cfg = toProviderConfig(tournament);
  const games = await getProvider(cfg.provider).fetchFixtures(cfg, ["hu", "en"]);
  const apiGameDates = new Map<string, string>();

  for (const game of games) {
    const homeTeamId = await upsertTeam(
      cfg.provider,
      game.home.externalId,
      game.home.name,
      game.home.logoUrl,
    );
    const awayTeamId = await upsertTeam(
      cfg.provider,
      game.away.externalId,
      game.away.name,
      game.away.logoUrl,
    );

    const newStatus = game.status;
    apiGameDates.set(game.externalId, game.scheduledAt.toISOString());

    const existingMatch = await db.query.matches.findFirst({
      where: and(eq(matches.tournamentId, tournament.id), eq(matches.externalId, game.externalId)),
    });

    if (existingMatch) {
      const wasFinished = existingMatch.status === "finished";
      const wasCancelled = existingMatch.status === "cancelled";
      const teamsSwapped =
        existingMatch.homeTeamId === awayTeamId && existingMatch.awayTeamId === homeTeamId;

      await db
        .update(matches)
        .set({
          status: newStatus,
          homeTeamId,
          awayTeamId,
          homeScore: game.homeScore,
          awayScore: game.awayScore,
          scheduledAt: game.scheduledAt,
          round: game.scheduledAt.toISOString().split("T")[0],
          updatedAt: new Date(),
        })
        .where(eq(matches.id, existingMatch.id));

      if (teamsSwapped && !wasFinished && !wasCancelled) {
        await flipBetsForMatch(existingMatch.id);
      }

      if (!wasFinished && newStatus === "finished") {
        await scoreMatch(existingMatch.id, game.homeScore ?? 0, game.awayScore ?? 0);
      }

      if (!wasCancelled && newStatus === "cancelled") {
        await refundMatch(existingMatch.id);
      }
    } else {
      await db.insert(matches).values({
        tournamentId: tournament.id,
        externalId: game.externalId,
        homeTeamId,
        awayTeamId,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        status: newStatus,
        scheduledAt: game.scheduledAt,
        round: game.scheduledAt.toISOString().split("T")[0],
      });
    }
  }

  return apiGameDates;
}

/** Sync odds from API, fill NULL oddsAtBet on existing bets. */
export async function syncOdds(tournament: Tournament): Promise<void> {
  const cfg = toProviderConfig(tournament);
  const oddsList = await getProvider(cfg.provider).fetchOdds(cfg);

  for (const odds of oddsList) {
    const match = await db.query.matches.findFirst({
      where: and(
        eq(matches.tournamentId, tournament.id),
        eq(matches.externalId, odds.externalGameId),
        eq(matches.status, "scheduled"),
      ),
    });
    if (!match) continue;

    await db.insert(matchOdds).values({
      matchId: match.id,
      homeOdds: odds.homeOdds,
      drawOdds: odds.drawOdds,
      awayOdds: odds.awayOdds,
    });

    const betsWithoutOdds = await db.query.bets.findMany({
      where: and(eq(bets.matchId, match.id), isNull(bets.oddsAtBet)),
    });

    for (const bet of betsWithoutOdds) {
      const relevantOdds = getRelevantOdds(bet.predictedHome, bet.predictedAway, odds);
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
  apiGameDates: Map<string, string>,
): Promise<void> {
  const overrides = await db
    .select({
      matchId: matchScheduleOverrides.matchId,
      overrideScheduledAt: matchScheduleOverrides.scheduledAt,
      externalId: matches.externalId,
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
      const apiDateStr = apiGameDates.get(o.externalId);
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

  // Betting days are bucketed in the tournament's timezone (NOT UTC), so a
  // match's tokens are released on its local calendar day. See dateToDateNum.
  const tournament = await db.query.tournaments.findFirst({
    where: eq(tournaments.id, tournamentId),
    columns: { timezone: true },
  });
  const timeZone = tournament?.timezone ?? "UTC";

  for (const group of tournamentGroups) {
    const eligibleMatches = await db.query.matches.findMany({
      where: and(
        eq(matches.tournamentId, tournamentId),
        eq(matches.status, "scheduled"),
        sql`DATE(${matches.scheduledAt} AT TIME ZONE ${timeZone}) <= DATE(now() AT TIME ZONE ${timeZone})`,
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
  tournamentList: (Tournament & { logoUrl: string | null })[],
): Promise<void> {
  for (const tournament of tournamentList) {
    if (tournament.logoUrl) continue;
    const cfg = toProviderConfig(tournament);
    const provider = getProvider(cfg.provider);
    const logoUrl = provider.fetchTournamentLogo ? await provider.fetchTournamentLogo(cfg) : null;
    if (logoUrl)
      await db.update(tournaments).set({ logoUrl }).where(eq(tournaments.id, tournament.id));
  }
}

// ── Helpers ──

async function upsertTeam(
  provider: ProviderId,
  externalId: string,
  name: string,
  logoUrl: string | null,
): Promise<string> {
  const [team] = await db
    .insert(teams)
    .values({ provider, externalId, name, logoUrl })
    .onConflictDoUpdate({
      target: [teams.provider, teams.externalId],
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
        lossPercentage: bet.group.lossPercentage,
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

async function flipBetsForMatch(matchId: string): Promise<void> {
  const latestOdds = await db.query.matchOdds.findFirst({
    where: eq(matchOdds.matchId, matchId),
    orderBy: desc(matchOdds.fetchedAt),
  });

  const pendingBets = await db.query.bets.findMany({
    where: and(eq(bets.matchId, matchId), isNull(bets.payout)),
  });

  for (const bet of pendingBets) {
    const flippedHome = bet.predictedAway;
    const flippedAway = bet.predictedHome;
    const newOddsAtBet = latestOdds
      ? getRelevantOdds(flippedHome, flippedAway, {
          homeOdds: latestOdds.homeOdds,
          drawOdds: latestOdds.drawOdds,
          awayOdds: latestOdds.awayOdds,
        })
      : null;

    await db
      .update(bets)
      .set({
        predictedHome: flippedHome,
        predictedAway: flippedAway,
        oddsAtBet: newOddsAtBet === null ? null : String(newOddsAtBet),
        updatedAt: new Date(),
      })
      .where(eq(bets.id, bet.id));
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
