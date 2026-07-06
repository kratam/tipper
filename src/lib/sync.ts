import { and, desc, eq, inArray, isNotNull, isNull, lte, ne, or, sql } from "drizzle-orm";
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
import { evaluateMatchBadges, evaluateRoundBadges, isRoundComplete } from "@/lib/badges/award";
import { expectedMatchDurationMs } from "@/lib/match-duration";
import { computeNextFinishCheck, delaySecondsUntil } from "@/lib/match-finish-schedule";
import { getProvider } from "@/lib/providers";
import type { ProviderId } from "@/lib/providers/types";
import { toProviderConfig } from "@/lib/providers/types";
import { scheduleMatchFinishCheck } from "@/lib/qstash";
import { hasApiScheduleImproved, isScheduleBroken } from "@/lib/schedule-override";
import { calculateBaseBetPayout, computePoolBase, distributeBonusPools } from "@/lib/scoring";
import { dateToDateNum, getRelevantOdds } from "@/lib/tokens";

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

  // Az odds-api league-átnevezéskor üres listát ad hiba helyett (2026-06-12 WC
  // incidens: international-world-cup → international-fifa-world-cup), így a
  // sync napokig némán no-op marad. Hangos log, hogy a Vercel logban látszódjon.
  if (games.length === 0) {
    const [{ count: existingCount }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(matches)
      .where(eq(matches.tournamentId, tournament.id));
    if (Number(existingCount) > 0) {
      console.error(
        `[sync] Provider returned 0 games for tournament ${tournament.id} but DB has ${existingCount} matches — possible league slug rename or API outage`,
      );
    }
    return apiGameDates;
  }

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

      // Update the mutable fields (scores, teams, schedule) but NOT the status.
      // The finished/cancelled transitions are claimed atomically below so two
      // concurrent syncs (overlapping cron ticks) can't both fire scoring or
      // refunds — see the compare-and-set updates with `ne(status, ...)`.
      await db
        .update(matches)
        .set({
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

      if (newStatus === "finished") {
        // Atomic claim: flip scheduled→finished exactly once. Only the winning
        // run gets a returned row and proceeds to score; concurrent runs (and
        // re-syncs of an already-finished match) get zero rows and skip.
        const claimed = await db
          .update(matches)
          .set({ status: "finished" })
          .where(and(eq(matches.id, existingMatch.id), ne(matches.status, "finished")))
          .returning({ id: matches.id });
        if (claimed.length > 0) {
          await scoreMatch(existingMatch.id, game.homeScore ?? 0, game.awayScore ?? 0);
          const matchRound = game.scheduledAt.toISOString().split("T")[0];
          if (await isRoundComplete(tournament.id, matchRound)) {
            await evaluateRoundBadges(tournament.id, matchRound);
          }
        }
      } else if (newStatus === "cancelled") {
        const claimed = await db
          .update(matches)
          .set({ status: "cancelled" })
          .where(and(eq(matches.id, existingMatch.id), ne(matches.status, "cancelled")))
          .returning({ id: matches.id });
        if (claimed.length > 0) {
          await refundMatch(existingMatch.id);
        }
      } else if (newStatus !== existingMatch.status) {
        // Non-scoring transition (e.g. scheduled→live): just reflect the status.
        await db.update(matches).set({ status: newStatus }).where(eq(matches.id, existingMatch.id));
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

// ── Match-finish lánc ütemezése ──

/**
 * Tornánként EGYETLEN match-finish recheck-lánc fenntartása. A `next_finish_check_at`
 * oszlop a szerződés: ha jövőbeli érték van benne, már fut a lánc. Az atomikus
 * compare-and-set claim garantálja, hogy két párhuzamos hívó (periodic + futó
 * match-finish) közül csak egy ütemez. A `<= now` feltétel teszi lehetővé az
 * önjavítást: egy elveszett (retries:0) láncot a következő hívó újrafoglal.
 */
export async function scheduleNextFinishCheck(tournamentId: string): Promise<void> {
  const tournament = await db.query.tournaments.findFirst({
    where: eq(tournaments.id, tournamentId),
    columns: { id: true, providerSport: true },
  });
  if (!tournament) return;

  const pending = await db
    .select({ scheduledAt: matches.scheduledAt, status: matches.status })
    .from(matches)
    .where(
      and(eq(matches.tournamentId, tournamentId), inArray(matches.status, ["scheduled", "live"])),
    );

  const durationMs = expectedMatchDurationMs(tournament.providerSport);
  const now = new Date();
  const target = computeNextFinishCheck(
    pending.map((m) => ({
      scheduledAt: m.scheduledAt,
      status: m.status as "scheduled" | "live",
      durationMs,
    })),
    now,
  );

  if (target === null) {
    // Nincs több lezáratlan meccs — a lánc leáll.
    await db
      .update(tournaments)
      .set({ nextFinishCheckAt: null })
      .where(eq(tournaments.id, tournamentId));
    return;
  }

  // Atomikus claim: csak akkor ütemezünk, ha nincs jövőbeli függő check.
  const claimed = await db
    .update(tournaments)
    .set({ nextFinishCheckAt: target })
    .where(
      and(
        eq(tournaments.id, tournamentId),
        or(isNull(tournaments.nextFinishCheckAt), lte(tournaments.nextFinishCheckAt, now)),
      ),
    )
    .returning({ id: tournaments.id });

  if (claimed.length === 0) return; // már van jövőbeli check — nem duplikálunk

  await scheduleMatchFinishCheck(tournamentId, delaySecondsUntil(target, now));
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

  // Eligible matches depend only on the tournament + timezone, not the group —
  // compute them once instead of re-querying per group.
  const eligibleMatches = await db.query.matches.findMany({
    where: and(
      eq(matches.tournamentId, tournamentId),
      eq(matches.status, "scheduled"),
      sql`DATE(${matches.scheduledAt} AT TIME ZONE ${timeZone}) <= DATE(now() AT TIME ZONE ${timeZone})`,
    ),
    columns: { id: true },
  });

  if (eligibleMatches.length === 0) return;

  // Load every existing per-match distribution for this tournament in ONE query
  // and dedup in memory, instead of a COUNT round trip per (group × match ×
  // member). Previously this issued thousands of sequential neon-http requests
  // on every cron tick once a tournament was underway.
  const existingDistributions = await db
    .select({
      groupId: tokenLedger.groupId,
      userId: tokenLedger.userId,
      referenceId: tokenLedger.referenceId,
    })
    .from(tokenLedger)
    .where(
      and(
        eq(tokenLedger.tournamentId, tournamentId),
        eq(tokenLedger.type, "distribution"),
        isNotNull(tokenLedger.referenceId),
      ),
    );

  const distributedKey = (groupId: string, userId: string, matchId: string) =>
    `${groupId}:${userId}:${matchId}`;
  const seen = new Set(
    existingDistributions.map((r) => distributedKey(r.groupId, r.userId, r.referenceId ?? "")),
  );

  // Collect all missing rows and insert them in a single statement.
  const rows: (typeof tokenLedger.$inferInsert)[] = [];
  for (const group of tournamentGroups) {
    for (const match of eligibleMatches) {
      for (const member of group.members) {
        if (seen.has(distributedKey(group.id, member.userId, match.id))) continue;
        rows.push({
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

  if (rows.length > 0) {
    await db.insert(tokenLedger).values(rows);
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

  if (pendingBets.length > 0) {
    const match = await db.query.matches.findFirst({
      where: eq(matches.id, matchId),
      with: { tournament: true },
    });
    if (match) {
      const timeZone = match.tournament.timezone;
      const matchDateNum = dateToDateNum(match.scheduledAt, timeZone);
      const tournamentMatches = await db.query.matches.findMany({
        where: eq(matches.tournamentId, match.tournamentId),
        columns: { scheduledAt: true, status: true },
      });
      // A pool-alap "matchesToDate" tagja: hány nem-törölt torna-meccs dátuma
      // esik M dátumára vagy elé (ennyi per-meccs token-osztás történt eddig).
      const matchesToDate = tournamentMatches.filter(
        (m) => m.status !== "cancelled" && dateToDateNum(m.scheduledAt, timeZone) <= matchDateNum,
      ).length;

      // A token/pool csoport-szintű, ezért a pending tippeket csoportonként
      // dolgozzuk fel: minden csoportra külön pool-alap és külön bónusz-szétosztás.
      const byGroup = new Map<string, typeof pendingBets>();
      for (const bet of pendingBets) {
        const arr = byGroup.get(bet.groupId);
        if (arr) arr.push(bet);
        else byGroup.set(bet.groupId, [bet]);
      }

      for (const [groupId, groupBets] of byGroup) {
        const group = groupBets[0].group;

        const baseResults = groupBets.map((bet) => ({
          bet,
          base: calculateBaseBetPayout({
            predictedHome: bet.predictedHome,
            predictedAway: bet.predictedAway,
            actualHome: homeScore,
            actualAway: awayScore,
            stake: bet.stake,
            oddsAtBet: bet.oddsAtBet ? Number.parseFloat(bet.oddsAtBet) : null,
            oddsBoost: group.oddsBoost,
            lossPercentage: group.lossPercentage,
          }),
        }));

        const goalDiffHitters = baseResults.filter((r) => r.base.goalDiffCorrect).length;
        const exactScoreHitters = baseResults.filter((r) => r.base.exactScoreCorrect).length;

        const bettorIds = [...new Set(groupBets.map((b) => b.userId))];
        const netsByUser = await getBettorResolvedNets(groupId, bettorIds, timeZone, matchDateNum);
        const poolBase = computePoolBase({
          initialTokens: group.initialTokens,
          tokenPerMatch: group.tokenPerMatch,
          matchesToDate,
          bettorResolvedNets: bettorIds.map((id) => netsByUser.get(id) ?? 0),
        });

        const { goalDiffPerHitter, exactScorePerHitter } = distributeBonusPools({
          poolBase,
          goalDiffHitters,
          exactScoreHitters,
          goalDiffPct: group.bonusGoalDiffPct,
          exactScorePct: group.bonusExactScorePct,
        });

        for (const { bet, base } of baseResults) {
          const payout =
            base.basePayout +
            (base.goalDiffCorrect ? goalDiffPerHitter : 0) +
            (base.exactScoreCorrect ? exactScorePerHitter : 0);

          // Atomic claim: only the run that flips `payout` from NULL gets to
          // write the `win` ledger row. Two concurrent scoreMatch passes both
          // read this bet with payout IS NULL, but the `WHERE payout IS NULL`
          // guard means exactly one UPDATE returns a row — the others get zero
          // and skip, so no duplicate `win` entries can be inserted.
          const claimed = await db
            .update(bets)
            .set({
              payout,
              result1x2Correct: base.result1x2Correct,
              goalDiffCorrect: base.goalDiffCorrect,
              exactScoreCorrect: base.exactScoreCorrect,
              updatedAt: new Date(),
            })
            .where(and(eq(bets.id, bet.id), isNull(bets.payout)))
            .returning({ id: bets.id });

          if (claimed.length === 0) continue;

          if (payout > 0) {
            await db.insert(tokenLedger).values({
              userId: bet.userId,
              groupId: bet.groupId,
              tournamentId: group.tournamentId,
              amount: payout,
              type: "win",
              referenceId: bet.id,
            });
          }
        }
      }
    }
  }
  await evaluateMatchBadges(matchId);
}

/**
 * Tippelőnként a rendezett tét-nettók (payout − stake) összege az M-nél KORÁBBI
 * dátumú, már lepontozott tippjeikből ebben a csoportban. Dátum-alapú (nem M
 * saját tipp-/ledger-állapotától függ) → a pool-alap idempotens marad
 * újrapontozásra és párhuzamos cron-futásokra is.
 */
async function getBettorResolvedNets(
  groupId: string,
  bettorIds: string[],
  timeZone: string,
  matchDateNum: number,
): Promise<Map<string, number>> {
  const nets = new Map<string, number>();
  if (bettorIds.length === 0) return nets;

  const resolved = await db.query.bets.findMany({
    where: and(eq(bets.groupId, groupId), inArray(bets.userId, bettorIds), isNotNull(bets.payout)),
    columns: { userId: true, stake: true, payout: true },
    with: { match: { columns: { scheduledAt: true } } },
  });

  for (const b of resolved) {
    if (b.payout == null) continue;
    if (dateToDateNum(b.match.scheduledAt, timeZone) >= matchDateNum) continue;
    nets.set(b.userId, (nets.get(b.userId) ?? 0) + (b.payout - b.stake));
  }
  return nets;
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
