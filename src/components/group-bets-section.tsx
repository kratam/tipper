"use client";

import { useTranslations } from "next-intl";
import { MatchStatsTab } from "@/components/match-stats-tab";
import { MatchTipsTab } from "@/components/match-tips-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { GroupBetsForMatch } from "@/queries/bets";

interface GroupBetsSectionProps {
  group: GroupBetsForMatch;
  currentUserId: string;
  isFinished: boolean;
  homeScore: number | null;
  awayScore: number | null;
  youLabel: string;
}

/** One group's bets for a started match, split into Tippek and Statisztika sub-tabs. */
export function GroupBetsSection({
  group,
  currentUserId,
  isFinished,
  homeScore,
  awayScore,
  youLabel,
}: GroupBetsSectionProps) {
  const t = useTranslations("matches");

  return (
    <Tabs defaultValue="tips" className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="tips">{t("tipsTab")}</TabsTrigger>
        <TabsTrigger value="stats">{t("statsTab")}</TabsTrigger>
      </TabsList>
      <TabsContent value="tips" className="pt-2">
        <MatchTipsTab
          bets={group.bets}
          currentUserId={currentUserId}
          isFinished={isFinished}
          youLabel={youLabel}
          oddsBoost={group.oddsBoost}
        />
      </TabsContent>
      <TabsContent value="stats" className="pt-2">
        <MatchStatsTab
          bets={group.bets}
          homeScore={homeScore}
          awayScore={awayScore}
          isFinished={isFinished}
        />
      </TabsContent>
    </Tabs>
  );
}
