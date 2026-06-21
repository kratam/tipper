"use client";

import { Check, Lock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { BetDialog } from "@/components/bet-dialog";
import { GroupTokenSummary } from "@/components/group-token-summary";
import { MatchCard, type MatchCardData } from "@/components/match-card";
import { PodiumForm } from "@/components/podium-form";
import { TournamentBoardPanel } from "@/components/tournament-board-panel";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  lossPercentage: number;
  bonusGoalDiff: number;
  bonusExactScore: number;
  bonusPodiumMention: number;
  bonusPodiumExact: number;
  existingBet: {
    id: string;
    predictedHome: number;
    predictedAway: number;
    stake: number;
    oddsAtBet: string | null;
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
  tokenPerMatch: number;
  initialTokens: number;
  bonusGoalDiff: number;
  bonusExactScore: number;
  bonusPodiumMention: number;
  bonusPodiumExact: number;
  oddsBoost: number;
  lossPercentage: number;
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
  circleCards: {
    circleId: string;
    circleName: string;
    circleSlug: string;
    tournamentSlug: string;
    myProfit: number;
    myRank: number | null;
    miniLeaderboard: {
      rank: number;
      userId: string;
      userName: string;
      userAvatarUrl: string | null;
      profit: number;
    }[];
  }[];
  boardTabs: import("@/components/tournament-board-panel").BoardTab[];
  officialInitialRound: import("@/queries/tip-matrix").TipMatrixRound | null;
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
  circleCards: _circleCards,
  boardTabs,
  officialInitialRound,
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

  // Per-group card data: merge leaderboard info with next-3-days bet progress and balance.
  // The official group is rendered separately (OfficialGroupRibbon), so we filter it out here.
  // "next 3 days" = rolling 72h window from now (matches getUpcomingBetSummary semantics).
  const { groupCardData, officialNext3Days } = useMemo(() => {
    const cutoff = Date.now() + 3 * 24 * 60 * 60 * 1000;
    const next3DaysMap = new Map<string, { total: number; withBet: number }>();
    for (const match of liveMatches) {
      if (match.status !== "scheduled") continue;
      if (new Date(match.scheduledAt).getTime() >= cutoff) continue;
      const groupInfos = sortedGroupInfosByMatch[match.id] ?? [];
      for (const gi of groupInfos) {
        const entry = next3DaysMap.get(gi.groupId) ?? { total: 0, withBet: 0 };
        entry.total++;
        if (gi.existingBet) entry.withBet++;
        next3DaysMap.set(gi.groupId, entry);
      }
    }

    const emptyProgress = { total: 0, withBet: 0 };
    return {
      groupCardData: groupLeaderboards
        .filter((gl) => gl.groupId !== officialCard?.groupId)
        .map((gl) => ({
          ...gl,
          next3Days: next3DaysMap.get(gl.groupId) ?? emptyProgress,
        })),
      officialNext3Days: officialCard
        ? (next3DaysMap.get(officialCard.groupId) ?? emptyProgress)
        : emptyProgress,
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
      <div className="flex flex-col gap-3">
        {officialCard && (
          <TournamentBoardPanel
            currentUserId={currentUserId}
            timeZone={timezone}
            officialRank={officialCard.myRank}
            officialProfit={officialCard.myProfit}
            next3Days={officialNext3Days}
            tabs={boardTabs}
            officialInitialRound={officialInitialRound}
          />
        )}

        {groupCardData.length === 0 && (
          <GroupTokenSummary topPublicGroups={topPublicGroups} hasOfficialGroup={!!officialCard} />
        )}

        {/* Unified filter row: upcoming / played / all / podium */}
        <Tabs value={filter} onValueChange={(value) => setFilter(value as MatchFilter)}>
          <TabsList className="w-full">
            <TabsTrigger value="upcoming">{tMatches("upcoming")}</TabsTrigger>
            <TabsTrigger value="played">{tMatches("played")}</TabsTrigger>
            <TabsTrigger value="all">{tMatches("all")}</TabsTrigger>
            <TabsTrigger value="podium">
              <span>{t("podium")}</span>
              {existingPodiumBet ? (
                <Check
                  className="size-3.5 text-emerald-600 dark:text-emerald-400"
                  aria-label={t("podiumTab.submitted")}
                />
              ) : isLocked ? (
                <Lock
                  className="size-3.5 text-muted-foreground"
                  aria-label={t("podiumTab.locked")}
                />
              ) : null}
            </TabsTrigger>
          </TabsList>
        </Tabs>

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
            {filteredDays.map((day) => {
              const betCount = day.matches.filter((m) =>
                sortedGroupInfosByMatch[m.id]?.some((g) => g.existingBet),
              ).length;
              const isFull = betCount === day.matches.length && day.matches.length > 0;
              return (
                <AccordionItem key={day.dateKey} value={day.dateKey} className="border-none">
                  <AccordionTrigger className="h-10 gap-2.5 rounded-[calc(var(--radius)*0.85)] border border-border bg-surface-2 px-4 transition-[border-color,box-shadow] hover:bg-surface-3 hover:no-underline">
                    <span className="flex items-center gap-2.5">
                      <span className="font-[650] text-[14px]">{day.label}</span>
                      <span
                        className={`font-mono text-[12px] ${isFull ? "text-win" : "text-faint"}`}
                      >
                        {t("betProgress", {
                          betCount,
                          total: day.matches.length,
                        })}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pt-3 pb-0">
                    <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2 min-[880px]:grid-cols-3">
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
              );
            })}
          </Accordion>
        )}
      </div>

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
        currentUserId={currentUserId}
        timeZone={timezone}
      />
    </>
  );
}
