"use client";

import { Check, Lock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { BetDialog } from "@/components/bet-dialog";
import { GroupTokenSummary } from "@/components/group-token-summary";
import { MatchCard, type MatchCardData } from "@/components/match-card";
import { OfficialGroupRibbon } from "@/components/official-group-ribbon";
import { PodiumForm } from "@/components/podium-form";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useMatchPolling } from "@/hooks/use-match-polling";
import type { PublicGroupSuggestion } from "@/queries/groups";

interface GroupBetInfo {
  groupId: string;
  groupName: string;
  balance: number;
  projectedBalance: number;
  pendingDistributions: number;
  tokenPerMatch: number;
  initialTokens: number;
  eligibleMatchCount: number;
  winnings: number;
  losses: number;
  otherActiveStakes: number;
  oddsBoost: number;
  existingBet: {
    id: string;
    predictedHome: number;
    predictedAway: number;
    stake: number;
  } | null;
  unbettedMatchCountOnDay?: number;
}

interface TeamOption {
  id: string;
  name: string;
  logoUrl: string | null;
}

interface ExistingPodiumBet {
  goldTeamId: string;
  silverTeamId: string;
  bronzeTeamId: string;
}

interface MiniLeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  profit: number;
}

interface GroupLeaderboardData {
  groupId: string;
  groupName: string;
  groupSlug: string;
  tournamentSlug: string;
  myProfit: number;
  myRank: number | null;
  miniLeaderboard: MiniLeaderboardEntry[];
}

interface OfficialCardData {
  groupId: string;
  groupName: string;
  groupSlug: string;
  tournamentSlug: string;
  oddsBoost: number;
  tokenPerMatch: number;
  myProfit: number;
  myRank: number | null;
  miniLeaderboard: MiniLeaderboardEntry[];
}

interface TournamentTabsProps {
  matches: MatchCardData[];
  tournamentId: string;
  timezone: string;
  podiumLockDate: string;
  teams: TeamOption[];
  existingPodiumBet: ExistingPodiumBet | null;
  groupBetInfosByMatch: Record<string, GroupBetInfo[]>;
  groupLeaderboards: GroupLeaderboardData[];
  currentUserId: string;
  topPublicGroups?: PublicGroupSuggestion[];
  officialCard: OfficialCardData | null;
}

type MatchFilter = "upcoming" | "played" | "all" | "podium";

function formatDayHeader(dateStr: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    timeZone,
  }).format(new Date(dateStr));
}

function getDateKey(dateStr: string, timeZone: string): string {
  // Use Intl to get date parts in the event timezone — consistent on server & client
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(new Date(dateStr));
  // en-CA formats as YYYY-MM-DD
  return parts;
}

function getTodayKey(timeZone: string): string {
  return getDateKey(new Date().toISOString(), timeZone);
}

function isFutureOrToday(dateKey: string, timeZone: string): boolean {
  return dateKey >= getTodayKey(timeZone);
}

export function TournamentTabs({
  matches,
  tournamentId,
  timezone,
  podiumLockDate,
  teams,
  existingPodiumBet,
  groupBetInfosByMatch,
  groupLeaderboards,
  currentUserId,
  topPublicGroups = [],
  officialCard,
}: TournamentTabsProps) {
  const t = useTranslations("tournaments");
  const tMatches = useTranslations("matches");
  const locale = useLocale();

  const [filter, setFilter] = useState<MatchFilter>("upcoming");
  const [selectedMatch, setSelectedMatch] = useState<MatchCardData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Live polling: merge fresh score/status/bet data from SWR
  const liveMatches = useMatchPolling(tournamentId, matches);

  // Ensure the official group is always first inside each match's group list
  const sortedGroupInfosByMatch = useMemo(() => {
    const result: Record<string, GroupBetInfo[]> = {};
    for (const [matchId, groupInfos] of Object.entries(groupBetInfosByMatch)) {
      result[matchId] = [...groupInfos].sort((a, b) => {
        if (a.groupId === officialCard?.groupId) return -1;
        if (b.groupId === officialCard?.groupId) return 1;
        return 0;
      });
    }
    return result;
  }, [groupBetInfosByMatch, officialCard?.groupId]);

  // Per-group card data: merge leaderboard info with unbetted counts and balance.
  // The official group is rendered separately (OfficialGroupRibbon), so we filter it out here.
  const { groupCardData, officialUnbettedCount } = useMemo(() => {
    const unbettedMap = new Map<string, number>();
    for (const match of liveMatches) {
      if (match.status !== "scheduled") continue;
      const groupInfos = sortedGroupInfosByMatch[match.id] ?? [];
      for (const gi of groupInfos) {
        if (!gi.existingBet) {
          unbettedMap.set(gi.groupId, (unbettedMap.get(gi.groupId) ?? 0) + 1);
        }
      }
    }

    return {
      groupCardData: groupLeaderboards
        .filter((gl) => gl.groupId !== officialCard?.groupId)
        .map((gl) => ({
          ...gl,
          unbettedCount: unbettedMap.get(gl.groupId) ?? 0,
        })),
      officialUnbettedCount: officialCard ? (unbettedMap.get(officialCard.groupId) ?? 0) : 0,
    };
  }, [liveMatches, sortedGroupInfosByMatch, groupLeaderboards, officialCard]);

  // Group matches by day
  const dayGroups = useMemo(() => {
    const map = new Map<string, { dateKey: string; label: string; matches: MatchCardData[] }>();
    for (const match of liveMatches) {
      const dateKey = getDateKey(match.scheduledAt, timezone);
      const existing = map.get(dateKey);
      if (existing) {
        existing.matches.push(match);
      } else {
        map.set(dateKey, {
          dateKey,
          label: formatDayHeader(match.scheduledAt, locale, timezone),
          matches: [match],
        });
      }
    }
    return Array.from(map.values());
  }, [liveMatches, locale, timezone]);

  // Filter days based on selected filter
  const filteredDays = useMemo(() => {
    if (filter === "upcoming") {
      return dayGroups
        .filter((day) => isFutureOrToday(day.dateKey, timezone))
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    }
    if (filter === "played") {
      return dayGroups
        .filter((day) => !isFutureOrToday(day.dateKey, timezone))
        .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    }
    // "all"
    return dayGroups.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [dayGroups, filter, timezone]);

  // Default open accordion items: first 3 day groups
  const initialOpen = useMemo(() => {
    return filteredDays.slice(0, 3).map((day) => day.dateKey);
  }, [filteredDays]);

  const isLocked = new Date() > new Date(podiumLockDate);

  // Per-group unbetted match count on the selected match's day
  const groupUnbettedCountOnSelectedDay = useMemo(() => {
    if (!selectedMatch) return {} as Record<string, number>;
    const dateKey = getDateKey(selectedMatch.scheduledAt, timezone);
    const day = dayGroups.find((d) => d.dateKey === dateKey);
    if (!day) return {} as Record<string, number>;
    const result: Record<string, number> = {};
    for (const match of day.matches) {
      if (match.status !== "scheduled") continue;
      const groupInfos = sortedGroupInfosByMatch[match.id] ?? [];
      for (const gi of groupInfos) {
        if (!gi.existingBet) {
          result[gi.groupId] = (result[gi.groupId] ?? 0) + 1;
        }
      }
    }
    return result;
  }, [selectedMatch, dayGroups, sortedGroupInfosByMatch, timezone]);

  function handleMatchClick(match: MatchCardData) {
    setSelectedMatch(match);
    setDialogOpen(true);
  }

  return (
    <>
      {officialCard && (
        <div className="mb-4">
          <OfficialGroupRibbon
            groupName={officialCard.groupName}
            groupSlug={officialCard.groupSlug}
            tournamentSlug={officialCard.tournamentSlug}
            oddsBoost={officialCard.oddsBoost}
            myProfit={officialCard.myProfit}
            myRank={officialCard.myRank}
            miniLeaderboard={officialCard.miniLeaderboard}
            currentUserId={currentUserId}
            unbettedCount={officialUnbettedCount}
          />
        </div>
      )}

      {filter !== "podium" && (
        <GroupTokenSummary
          groups={groupCardData}
          currentUserId={currentUserId}
          topPublicGroups={topPublicGroups}
          hasOfficialGroup={!!officialCard}
        />
      )}

      {/* Unified filter row: upcoming / played / all / podium */}
      <div className="my-4 flex gap-1 rounded-lg bg-muted p-1">
        <button
          type="button"
          onClick={() => setFilter("upcoming")}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium text-sm transition-colors ${
            filter === "upcoming"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {tMatches("upcoming")}
        </button>
        <button
          type="button"
          onClick={() => setFilter("played")}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium text-sm transition-colors ${
            filter === "played"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {tMatches("played")}
        </button>
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium text-sm transition-colors ${
            filter === "all"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {tMatches("all")}
        </button>
        <button
          type="button"
          onClick={() => setFilter("podium")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-sm transition-colors ${
            filter === "podium"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>{t("podium")}</span>
          {existingPodiumBet ? (
            <Check
              className="size-3.5 text-emerald-600 dark:text-emerald-400"
              aria-label={t("podiumTab.submitted")}
            />
          ) : isLocked ? (
            <Lock className="size-3.5 text-muted-foreground" aria-label={t("podiumTab.locked")} />
          ) : null}
        </button>
      </div>

      {filter === "podium" ? (
        <div className="flex flex-col gap-4">
          <PodiumForm
            tournamentId={tournamentId}
            teams={teams}
            existingBet={existingPodiumBet}
            isLocked={isLocked}
          />
        </div>
      ) : filteredDays.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">{tMatches("noMatches")}</p>
      ) : (
        <Accordion type="multiple" defaultValue={initialOpen} className="flex flex-col gap-2">
          {filteredDays.map((day) => (
            <AccordionItem key={day.dateKey} value={day.dateKey} className="border-none">
              <AccordionTrigger className="rounded-lg bg-muted px-4 py-2.5 hover:no-underline">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{day.label}</span>
                  <span className="text-muted-foreground text-xs">
                    {t("betProgress", {
                      betCount: day.matches.filter((m) =>
                        sortedGroupInfosByMatch[m.id]?.some((g) => g.existingBet),
                      ).length,
                      total: day.matches.length,
                    })}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-2">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {day.matches.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      timezone={timezone}
                      onClick={() => handleMatchClick(match)}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <BetDialog
        match={selectedMatch}
        groups={
          selectedMatch
            ? (sortedGroupInfosByMatch[selectedMatch.id] ?? []).map((g) => ({
                ...g,
                unbettedMatchCountOnDay: Math.max(
                  1,
                  groupUnbettedCountOnSelectedDay[g.groupId] ?? 1,
                ),
              }))
            : []
        }
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        topPublicGroups={topPublicGroups}
      />
    </>
  );
}
