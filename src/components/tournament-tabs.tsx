"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { BetDialog } from "@/components/bet-dialog";
import { MatchCard, type MatchCardData } from "@/components/match-card";
import { PodiumForm } from "@/components/podium-form";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface GroupBetInfo {
  groupId: string;
  groupName: string;
  balance: number;
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

interface TournamentTabsProps {
  matches: MatchCardData[];
  tournamentId: string;
  podiumLockDate: string;
  teams: TeamOption[];
  podiumGroups: PodiumGroupData[];
  groupBetInfosByMatch: Record<string, GroupBetInfo[]>;
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

function isToday(dateKey: string): boolean {
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return dateKey === todayKey;
}

function isTomorrow(dateKey: string): boolean {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  return dateKey === tomorrowKey;
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
}: TournamentTabsProps) {
  const t = useTranslations("tournaments");
  const tMatches = useTranslations("matches");
  const tPodium = useTranslations("podium");
  const locale = useLocale();

  const [filter, setFilter] = useState<MatchFilter>("upcoming");
  const [selectedMatch, setSelectedMatch] = useState<MatchCardData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Group matches by day
  const dayGroups = useMemo(() => {
    const map = new Map<string, { dateKey: string; label: string; matches: MatchCardData[] }>();
    for (const match of matches) {
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
  }, [matches, locale]);

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

  // Default open accordion items: today and tomorrow
  const defaultOpenDays = useMemo(() => {
    return filteredDays
      .filter((day) => isToday(day.dateKey) || isTomorrow(day.dateKey))
      .map((day) => day.dateKey);
  }, [filteredDays]);

  // If no today/tomorrow, open the first day
  const initialOpen = defaultOpenDays.length > 0 ? defaultOpenDays : filteredDays.length > 0 ? [filteredDays[0].dateKey] : [];

  const isLocked = new Date() > new Date(podiumLockDate);

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
                        {t("matchCount", { count: day.matches.length })}
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
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
