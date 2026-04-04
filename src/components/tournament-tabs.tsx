"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { BetDialog } from "@/components/bet-dialog";
import { GroupTokenSummary } from "@/components/group-token-summary";
import { MatchCard, type MatchCardData } from "@/components/match-card";
import { PodiumForm } from "@/components/podium-form";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMatchPolling } from "@/hooks/use-match-polling";

interface GroupBetInfo {
  groupId: string;
  groupName: string;
  balance: number;
  projectedBalance: number;
  pendingDistributions: number;
  tokenPerMatch: number;
  existingBet: {
    id: string;
    predictedHome: number;
    predictedAway: number;
    stake: number;
  } | null;
}

interface TeamOption {
  id: string;
  name: string;
  logoUrl: string | null;
}

interface PodiumGroupData {
  groupId: string;
  groupName: string;
  existingBet: {
    goldTeamId: string;
    silverTeamId: string;
    bronzeTeamId: string;
  } | null;
}

interface MiniLeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  profit: number;
}

interface GroupLeaderboardData {
  groupId: string;
  groupName: string;
  groupSlug: string;
  myProfit: number;
  myRank: number | null;
  miniLeaderboard: MiniLeaderboardEntry[];
}

interface TournamentTabsProps {
  matches: MatchCardData[];
  tournamentId: string;
  podiumLockDate: string;
  teams: TeamOption[];
  podiumGroups: PodiumGroupData[];
  groupBetInfosByMatch: Record<string, GroupBetInfo[]>;
  groupLeaderboards: GroupLeaderboardData[];
  currentUserId: string;
}

type MatchFilter = "upcoming" | "played" | "all";

function formatDayHeader(dateStr: string, locale: string): string {
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(d);
}

function getDateKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isFutureOrToday(dateKey: string): boolean {
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return dateKey >= todayKey;
}

export function TournamentTabs({
  matches,
  tournamentId,
  podiumLockDate,
  teams,
  podiumGroups,
  groupBetInfosByMatch,
  groupLeaderboards,
  currentUserId,
}: TournamentTabsProps) {
  const t = useTranslations("tournaments");
  const tMatches = useTranslations("matches");
  const tPodium = useTranslations("podium");
  const locale = useLocale();

  const [filter, setFilter] = useState<MatchFilter>("upcoming");
  const [selectedMatch, setSelectedMatch] = useState<MatchCardData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Live polling: merge fresh score/status/bet data from SWR
  const liveMatches = useMatchPolling(tournamentId, matches);

  // Per-group card data: merge leaderboard info with unbetted counts and balance
  const groupCardData = useMemo(() => {
    const unbettedMap = new Map<string, number>();
    for (const match of liveMatches) {
      if (match.status !== "scheduled") continue;
      const groupInfos = groupBetInfosByMatch[match.id] ?? [];
      for (const gi of groupInfos) {
        if (!gi.existingBet) {
          unbettedMap.set(gi.groupId, (unbettedMap.get(gi.groupId) ?? 0) + 1);
        }
      }
    }

    return groupLeaderboards.map((gl) => {
      const anyMatchInfos = Object.values(groupBetInfosByMatch).find((infos) =>
        infos.some((i) => i.groupId === gl.groupId),
      );
      const balance = anyMatchInfos?.find((i) => i.groupId === gl.groupId)?.balance ?? 0;

      return {
        ...gl,
        balance,
        unbettedCount: unbettedMap.get(gl.groupId) ?? 0,
      };
    });
  }, [liveMatches, groupBetInfosByMatch, groupLeaderboards]);

  // Group matches by day
  const dayGroups = useMemo(() => {
    const map = new Map<string, { dateKey: string; label: string; matches: MatchCardData[] }>();
    for (const match of liveMatches) {
      const dateKey = getDateKey(match.scheduledAt);
      const existing = map.get(dateKey);
      if (existing) {
        existing.matches.push(match);
      } else {
        map.set(dateKey, {
          dateKey,
          label: formatDayHeader(match.scheduledAt, locale),
          matches: [match],
        });
      }
    }
    return Array.from(map.values());
  }, [liveMatches, locale]);

  // Filter days based on selected filter
  const filteredDays = useMemo(() => {
    if (filter === "upcoming") {
      return dayGroups
        .filter((day) => isFutureOrToday(day.dateKey))
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    }
    if (filter === "played") {
      return dayGroups
        .filter((day) => !isFutureOrToday(day.dateKey))
        .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    }
    // "all"
    return dayGroups.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [dayGroups, filter]);

  // Default open accordion items: first 3 day groups
  const initialOpen = useMemo(() => {
    return filteredDays.slice(0, 3).map((day) => day.dateKey);
  }, [filteredDays]);

  const isLocked = new Date() > new Date(podiumLockDate);

  // Count bettable (scheduled) matches on the selected match's day
  const bettableMatchCountToday = useMemo(() => {
    if (!selectedMatch) return 1;
    const dateKey = getDateKey(selectedMatch.scheduledAt);
    const day = dayGroups.find((d) => d.dateKey === dateKey);
    if (!day) return 1;
    return Math.max(1, day.matches.filter((m) => m.status === "scheduled").length);
  }, [selectedMatch, dayGroups]);

  function handleMatchClick(match: MatchCardData) {
    setSelectedMatch(match);
    setDialogOpen(true);
  }

  return (
    <>
      <Tabs defaultValue="matches">
        <TabsList>
          <TabsTrigger value="matches">{t("matches")}</TabsTrigger>
          <TabsTrigger value="podium">{t("podium")}</TabsTrigger>
        </TabsList>

        <TabsContent value="matches" className="mt-4 flex flex-col gap-4">
          {/* Group token summaries */}
          <GroupTokenSummary groups={groupCardData} currentUserId={currentUserId} />

          {/* Match filter */}
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setFilter("upcoming")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
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
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
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
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === "all"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tMatches("all")}
            </button>
          </div>

          {filteredDays.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">{tMatches("noMatches")}</p>
          ) : (
            <Accordion type="multiple" defaultValue={initialOpen} className="flex flex-col gap-2">
              {filteredDays.map((day) => (
                <AccordionItem key={day.dateKey} value={day.dateKey} className="border-none">
                  <AccordionTrigger className="rounded-lg bg-muted/50 px-4 py-2.5 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{day.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {t("betProgress", {
                          betCount: day.matches.filter((m) =>
                            groupBetInfosByMatch[m.id]?.some((g) => g.existingBet),
                          ).length,
                          total: day.matches.length,
                        })}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-0">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {day.matches.map((match) => (
                        <MatchCard
                          key={match.id}
                          match={match}
                          onClick={() => handleMatchClick(match)}
                        />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </TabsContent>

        <TabsContent value="podium" className="mt-4 flex flex-col gap-4">
          {podiumGroups.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">{tPodium("title")}</p>
          ) : (
            podiumGroups.map((pg) => (
              <PodiumForm
                key={pg.groupId}
                tournamentId={tournamentId}
                groupId={pg.groupId}
                groupName={pg.groupName}
                teams={teams}
                existingBet={pg.existingBet}
                isLocked={isLocked}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Bet dialog */}
      <BetDialog
        match={selectedMatch}
        groups={selectedMatch ? (groupBetInfosByMatch[selectedMatch.id] ?? []) : []}
        bettableMatchCountToday={bettableMatchCountToday}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
