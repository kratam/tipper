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
import { MatchDateTime } from "@/components/match-datetime";
import { MatchScoreboard } from "@/components/match-scoreboard";
import { PublicGroupDialog } from "@/components/public-group-dialog";
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
  /** Sikeres tipp-mutáció után fut — a tipp-mátrix ezzel tölti újra a fordulót. */
  onBetMutated?: () => void;
}

export function BetDialog({
  match,
  groups,
  open,
  onOpenChange,
  topPublicGroups = [],
  currentUserId,
  timeZone,
  onBetMutated,
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
  // Livescore nincs implementálva, ezért élő meccsnél nem mutatunk eredményt
  // (a 0-0 valószínűleg hamis) — helyette az "ÉLŐ" jelzés a középpont.
  const showScore =
    match.status === "finished" && match.homeScore !== null && match.awayScore !== null;

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

  const scoreboardCenter = showScore ? (
    <span className="font-extrabold font-mono text-[32px] tabular-nums">
      {match.homeScore} : {match.awayScore}
    </span>
  ) : match.status === "live" ? (
    <span className="flex items-center gap-1.5 font-bold text-[15px] text-loss">
      <Circle className="size-2 animate-pulse fill-loss text-loss" />
      {t("live")}
    </span>
  ) : (
    <span className="text-faint text-xs tracking-[0.15em]">{t("vs")}</span>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] gap-2 overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="sr-only">
              {match.homeTeam.name} – {match.awayTeam.name}
            </DialogTitle>
            <MatchDateTime
              scheduledAt={match.scheduledAt}
              timeZone={timeZone}
              className="font-mono text-[12px] text-muted-foreground"
            />
            <DialogDescription className="sr-only">
              {match.homeTeam.name} vs {match.awayTeam.name}
            </DialogDescription>
          </DialogHeader>

          {!match.participantsKnown ? (
            <p className="text-center text-muted-foreground text-sm">{t("participantsUnknown")}</p>
          ) : !matchStarted && groups.length > 0 ? (
            <BetForm
              matchId={match.id}
              groups={groups}
              odds={odds}
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
              onSuccess={groups.length <= 1 ? () => onOpenChange(false) : undefined}
              onBetMutated={onBetMutated}
            />
          ) : (
            <div className="flex flex-col gap-3">
              <MatchScoreboard
                homeTeam={match.homeTeam}
                awayTeam={match.awayTeam}
                center={scoreboardCenter}
              />
              {matchStarted ? (
                groupBetsData === undefined ? (
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
                )
              ) : topPublicGroups.length > 0 ? (
                <>
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
                </>
              ) : (
                <>
                  <p className="text-muted-foreground text-sm">{tTournaments("noPublicGroup")}</p>
                  <Button variant="outline" size="sm" asChild className="w-full gap-2">
                    <Link href="/groups/new">{tTournaments("createGroup")}</Link>
                  </Button>
                </>
              )}
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
