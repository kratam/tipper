"use client";

import { Circle, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import useSWR from "swr";
import { getMatchGroupBets } from "@/actions/live";
import { BetForm } from "@/components/bet-form";
import { GroupBetsSection } from "@/components/group-bets-section";
import { GroupCard } from "@/components/group-card";
import type { MatchCardData } from "@/components/match-card";
import { PublicGroupDialog } from "@/components/public-group-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@/i18n/navigation";
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
  existingBet: {
    id: string;
    predictedHome: number;
    predictedAway: number;
    stake: number;
  } | null;
  unbettedMatchCountOnDay: number;
}

interface BetDialogProps {
  match: MatchCardData | null;
  groups: GroupBetInfo[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topPublicGroups?: PublicGroupSuggestion[];
  currentUserId: string;
}

export function BetDialog({
  match,
  groups,
  open,
  onOpenChange,
  topPublicGroups = [],
  currentUserId,
}: BetDialogProps) {
  const t = useTranslations("matches");
  const tTournaments = useTranslations("tournaments");
  const [selectedPublicGroup, setSelectedPublicGroup] = useState<PublicGroupSuggestion | null>(
    null,
  );

  const matchStarted = match
    ? match.status === "live" ||
      match.status === "finished" ||
      match.status === "cancelled" ||
      new Date(match.scheduledAt) <= new Date()
    : false;

  const matchId = match?.id;
  const shouldFetchGroupBets = !!matchId && open && matchStarted;

  const { data: groupBetsData } = useSWR(
    shouldFetchGroupBets && matchId ? ["match-group-bets", matchId] : null,
    () => (matchId ? getMatchGroupBets(matchId) : Promise.resolve([])),
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );

  if (!match) return null;

  const isFinished = match.status === "finished";

  const odds = match.odds
    ? {
        homeOdds: match.odds.homeOdds,
        drawOdds: match.odds.drawOdds,
        awayOdds: match.odds.awayOdds,
      }
    : null;

  const renderGroupSection = (group: NonNullable<typeof groupBetsData>[number]) => (
    <GroupBetsSection
      group={group}
      currentUserId={currentUserId}
      isFinished={isFinished}
      homeScore={match.homeScore}
      awayScore={match.awayScore}
      youLabel={t("youLabel")}
    />
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {match.homeTeam.name} vs {match.awayTeam.name}
              {match.status === "live" && (
                <span className="flex items-center gap-1 font-medium text-red-500 text-xs">
                  <Circle className="size-1.5 animate-pulse fill-red-500 text-red-500" />
                  {t("live")}
                </span>
              )}
              {match.status === "finished" && (
                <Badge variant="outline" className="text-muted-foreground text-xs">
                  {t("finished")}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {match.homeTeam.name} vs {match.awayTeam.name}
            </DialogDescription>
          </DialogHeader>

          {!match.participantsKnown ? (
            <p className="text-center text-muted-foreground text-sm">{t("participantsUnknown")}</p>
          ) : matchStarted ? (
            <div className="flex flex-col gap-3">
              {(match.status === "finished" || match.status === "live") &&
                match.homeScore !== null &&
                match.awayScore !== null && (
                  <div className="text-center font-bold font-mono text-3xl tabular-nums tracking-wider">
                    {match.homeScore} - {match.awayScore}
                  </div>
                )}

              {groupBetsData === undefined ? (
                <p className="text-center text-muted-foreground text-sm">{t("loadingBets")}</p>
              ) : groupBetsData.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm">{t("betLocked")}</p>
              ) : groupBetsData.length === 1 ? (
                renderGroupSection(groupBetsData[0])
              ) : (
                <Tabs defaultValue={groupBetsData[0].groupId} className="w-full">
                  <TabsList className="w-full flex-wrap">
                    {groupBetsData.map((group) => (
                      <TabsTrigger key={group.groupId} value={group.groupId}>
                        {group.groupName}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {groupBetsData.map((group) => (
                    <TabsContent key={group.groupId} value={group.groupId} className="pt-1">
                      {renderGroupSection(group)}
                    </TabsContent>
                  ))}
                </Tabs>
              )}
            </div>
          ) : groups.length > 0 ? (
            <BetForm
              matchId={match.id}
              groups={groups}
              odds={odds}
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
              scheduledAt={match.scheduledAt}
              onSuccess={groups.length <= 1 ? () => onOpenChange(false) : undefined}
            />
          ) : topPublicGroups.length > 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-muted-foreground text-sm">{tTournaments("noGroupYetShort")}</p>
              <GroupCard
                group={topPublicGroups[0]}
                memberCount={topPublicGroups[0].memberCount}
                variant="public"
                onClick={() => setSelectedPublicGroup(topPublicGroups[0])}
              />
              <Button variant="outline" size="sm" asChild className="w-full gap-2">
                <Link href="/groups">
                  <Users className="size-4" />
                  {tTournaments("browseGroups")}
                </Link>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-muted-foreground text-sm">{tTournaments("noPublicGroup")}</p>
              <Button variant="outline" size="sm" asChild className="w-full gap-2">
                <Link href="/groups/new">{tTournaments("createGroup")}</Link>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {selectedPublicGroup && (
        <PublicGroupDialog
          group={selectedPublicGroup}
          memberCount={selectedPublicGroup.memberCount}
          open={!!selectedPublicGroup}
          onOpenChange={(open) => {
            if (!open) setSelectedPublicGroup(null);
          }}
        />
      )}
    </>
  );
}
