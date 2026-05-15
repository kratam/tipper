"use client";

import { Circle, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { BetForm } from "@/components/bet-form";
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
import { Link } from "@/i18n/navigation";
import type { PublicGroupSuggestion } from "@/queries/groups";

interface GroupBetInfo {
  groupId: string;
  groupName: string;
  balance: number;
  projectedBalance: number;
  pendingDistributions: number;
  tokenPerMatch: number;
  oddsBoost: number;
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
}

export function BetDialog({
  match,
  groups,
  open,
  onOpenChange,
  topPublicGroups = [],
}: BetDialogProps) {
  const t = useTranslations("matches");
  const tTournaments = useTranslations("tournaments");
  const [selectedPublicGroup, setSelectedPublicGroup] = useState<PublicGroupSuggestion | null>(
    null,
  );

  if (!match) return null;

  const matchStarted =
    match.status === "live" ||
    match.status === "finished" ||
    new Date(match.scheduledAt) <= new Date();

  const odds = match.odds
    ? {
        homeOdds: match.odds.homeOdds,
        drawOdds: match.odds.drawOdds,
        awayOdds: match.odds.awayOdds,
      }
    : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
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

          {matchStarted ? (
            /* Show result + existing bets for finished/live matches */
            <div className="flex flex-col gap-3">
              {(match.status === "finished" || match.status === "live") &&
                match.homeScore !== null &&
                match.awayScore !== null && (
                  <div className="text-center font-bold font-mono text-3xl tabular-nums tracking-wider">
                    {match.homeScore} - {match.awayScore}
                  </div>
                )}

              {match.userBets.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="font-medium text-sm">{t("yourBet")}</span>
                  {match.userBets.map((bet) => {
                    const betColor =
                      bet.result1x2Correct === null
                        ? "bg-muted/50"
                        : bet.result1x2Correct
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-destructive/10 text-destructive";
                    const netProfit = bet.payout != null ? bet.payout - bet.stake : null;
                    const netColor =
                      netProfit == null
                        ? "text-muted-foreground"
                        : netProfit > 0
                          ? "text-emerald-500"
                          : netProfit < 0
                            ? "text-destructive"
                            : "text-muted-foreground";
                    const netLabel =
                      netProfit == null
                        ? null
                        : netProfit > 0
                          ? `+${netProfit}`
                          : netProfit < 0
                            ? `${netProfit}`
                            : "±0";
                    return (
                      <div
                        key={bet.id}
                        className={`flex items-center justify-between rounded-lg p-3 ${betColor}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-xs">{bet.groupName}</span>
                          <span className="font-bold font-mono text-sm">
                            {bet.predictedHome} - {bet.predictedAway}
                          </span>
                          <span className="font-mono text-muted-foreground text-xs">
                            {bet.stake}🪙
                          </span>
                        </div>
                        {netLabel != null && (
                          <Badge variant="outline" className={`font-mono ${netColor}`}>
                            {netLabel}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {match.userBets.length === 0 && (
                <p className="text-center text-muted-foreground text-sm">{t("betLocked")}</p>
              )}
            </div>
          ) : groups.length > 0 ? (
            /* Bet form for upcoming matches */
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
