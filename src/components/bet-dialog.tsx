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
import { TeamLogo } from "@/components/team-logo";
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
    oddsAtBet: string | null;
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
  /** Tournament timezone — passed to BetForm so the date header matches the
   * match list's day grouping. */
  timeZone: string;
}

export function BetDialog({
  match,
  groups,
  open,
  onOpenChange,
  topPublicGroups = [],
  currentUserId,
  timeZone,
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
  const showScore =
    (match.status === "finished" || match.status === "live") &&
    match.homeScore !== null &&
    match.awayScore !== null;

  // BetForm már mutatja a zászlókat + neveket + dátumot a kártyában, ezért a fejléc
  // teljesen felesleges ilyenkor (a nevek belelógnának a jobb felső X-be is).
  const showBetForm = match.participantsKnown && !matchStarted && groups.length > 0;

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
            {showBetForm ? (
              // A BetForm kártya már tartalmazza a zászlókat, neveket és dátumot,
              // ezért a fejléc csak a kötelező (sr-only) címet adja.
              <DialogTitle className="sr-only">
                {match.homeTeam.name} – {match.awayTeam.name}
              </DialogTitle>
            ) : (
              <DialogTitle className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <TeamLogo name={match.homeTeam.name} logoUrl={match.homeTeam.logoUrl} />
                  <span className="truncate font-semibold text-sm">{match.homeTeam.name}</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  {showScore ? (
                    <span className="font-bold font-mono text-2xl tabular-nums tracking-wider">
                      {match.homeScore} – {match.awayScore}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/40 tracking-[0.15em]">
                      {t("vs")}
                    </span>
                  )}
                  {match.status === "live" && (
                    <span className="flex items-center gap-1 font-medium text-[10px] text-red-500">
                      <Circle className="size-1.5 animate-pulse fill-red-500 text-red-500" />
                      {t("live")}
                    </span>
                  )}
                  {match.status === "finished" && (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      {t("finished")}
                    </Badge>
                  )}
                </div>
                <div className="flex min-w-0 items-center justify-end gap-2">
                  <span className="truncate text-right font-semibold text-sm">
                    {match.awayTeam.name}
                  </span>
                  <TeamLogo name={match.awayTeam.name} logoUrl={match.awayTeam.logoUrl} />
                </div>
              </DialogTitle>
            )}
            <DialogDescription className="sr-only">
              {match.homeTeam.name} vs {match.awayTeam.name}
            </DialogDescription>
          </DialogHeader>

          {!match.participantsKnown ? (
            <p className="text-center text-muted-foreground text-sm">{t("participantsUnknown")}</p>
          ) : matchStarted ? (
            <div className="flex flex-col gap-3">
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
              timeZone={timeZone}
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
