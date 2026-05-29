import "server-only";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { db } from "@/db";
import { bets, matches, matchOdds } from "@/db/schema";
import type { Locale } from "@/lib/providers/types";
import { withMatchTeamDisplay } from "@/queries/team-display";

export async function getMatchesForTournament(tournamentId: string, useFlagFallback: boolean) {
  const locale = (await getLocale()) as Locale;
  const rows = await db.query.matches.findMany({
    where: eq(matches.tournamentId, tournamentId),
    with: {
      homeTeam: true,
      awayTeam: true,
      odds: {
        orderBy: [desc(matchOdds.fetchedAt)],
        limit: 1,
      },
    },
    orderBy: [matches.scheduledAt],
  });
  return rows.map((row) => withMatchTeamDisplay(row, locale, useFlagFallback));
}

export async function getMatchById(matchId: string) {
  const locale = (await getLocale()) as Locale;
  const row = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
    with: {
      homeTeam: true,
      awayTeam: true,
      tournament: true,
      odds: {
        orderBy: [desc(matchOdds.fetchedAt)],
        limit: 1,
      },
    },
  });
  if (!row) return row;
  return withMatchTeamDisplay(row, locale, row.tournament.useFlagFallback);
}

export async function getFinishedMatchesForTournament(
  tournamentId: string,
  useFlagFallback: boolean,
) {
  const locale = (await getLocale()) as Locale;
  const rows = await db.query.matches.findMany({
    where: and(eq(matches.tournamentId, tournamentId), eq(matches.status, "finished")),
    with: {
      homeTeam: true,
      awayTeam: true,
      odds: {
        orderBy: [desc(matchOdds.fetchedAt)],
        limit: 1,
      },
    },
    orderBy: [desc(matches.scheduledAt)],
  });
  return rows.map((row) => withMatchTeamDisplay(row, locale, useFlagFallback));
}

export async function getLatestOdds(matchId: string) {
  return db.query.matchOdds.findFirst({
    where: eq(matchOdds.matchId, matchId),
    orderBy: [desc(matchOdds.fetchedAt)],
  });
}

export interface UpcomingDaySummary {
  dateKey: string;
  label: string;
  totalMatches: number;
  missingBets: number;
}

export async function getUpcomingBetSummary(
  tournamentId: string,
  groupId: string,
  userId: string,
  timezone: string,
  locale: string,
  useFlagFallback: boolean,
  days = 3,
): Promise<UpcomingDaySummary[]> {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + days);

  const [upcomingMatchesRaw, userBets] = await Promise.all([
    db.query.matches.findMany({
      where: and(
        eq(matches.tournamentId, tournamentId),
        eq(matches.status, "scheduled"),
        gte(matches.scheduledAt, now),
        lt(matches.scheduledAt, endDate),
      ),
      with: { homeTeam: true, awayTeam: true },
      orderBy: [matches.scheduledAt],
    }),
    db.query.bets.findMany({
      where: and(eq(bets.userId, userId), eq(bets.groupId, groupId)),
    }),
  ]);

  const upcomingMatches = upcomingMatchesRaw.map((row) =>
    withMatchTeamDisplay(row, locale as Locale, useFlagFallback),
  );

  const bettedMatchIds = new Set(userBets.map((b) => b.matchId));

  const dayMap = new Map<string, { label: string; total: number; missing: number }>();

  for (const match of upcomingMatches) {
    const dateKey = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: timezone,
    }).format(match.scheduledAt);

    const existing = dayMap.get(dateKey);
    const isMissing = !bettedMatchIds.has(match.id);

    if (existing) {
      existing.total++;
      if (isMissing) existing.missing++;
    } else {
      const label = formatRelativeDay(match.scheduledAt, timezone, locale);
      dayMap.set(dateKey, { label, total: 1, missing: isMissing ? 1 : 0 });
    }
  }

  return Array.from(dayMap.entries()).map(([dateKey, data]) => ({
    dateKey,
    label: data.label,
    totalMatches: data.total,
    missingBets: data.missing,
  }));
}

function formatRelativeDay(date: Date, timezone: string, locale: string): string {
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).format(new Date());

  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowKey = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).format(tomorrowDate);

  const dateKey = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).format(date);

  if (dateKey === todayKey) return locale === "hu" ? "Ma" : "Today";
  if (dateKey === tomorrowKey) return locale === "hu" ? "Holnap" : "Tomorrow";

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    weekday: "short",
    timeZone: timezone,
  }).format(date);
}
