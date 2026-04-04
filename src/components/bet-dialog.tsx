"use client";

import { Circle } from "lucide-react";
import { useTranslations } from "next-intl";
import { BetForm } from "@/components/bet-form";
import type { MatchCardData } from "@/components/match-card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  unbettedMatchCountOnDay: number;
}

interface BetDialogProps {
  match: MatchCardData | null;
  groups: GroupBetInfo[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BetDialog({ match, groups, open, onOpenChange }: BetDialogProps) {
  const t = useTranslations("matches");

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {match.homeTeam.name} vs {match.awayTeam.name}
            {match.status === "live" && (
              <span className="flex items-center gap-1 text-xs font-medium text-red-500">
                <Circle className="size-1.5 animate-pulse fill-red-500 text-red-500" />
                {t("live")}
              </span>
            )}
            {match.status === "finished" && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
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
                <div className="text-center font-mono text-3xl font-bold tabular-nums tracking-wider">
                  {match.homeScore} - {match.awayScore}
                </div>
              )}

            {match.userBets.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">{t("yourBet")}</span>
                {match.userBets.map((bet) => {
                  const betColor =
                    bet.result1x2Correct === null
                      ? "bg-muted/50"
                      : bet.result1x2Correct
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-destructive/10 text-destructive";
                  return (
                    <div
                      key={bet.id}
                      className={`flex items-center justify-between rounded-lg p-3 ${betColor}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{bet.groupName}</span>
                        <span className="font-mono text-sm font-bold">
                          {bet.predictedHome} - {bet.predictedAway}
                        </span>
                      </div>
                      {bet.payout != null && (
                        <Badge variant="outline" className="font-mono text-emerald-500">
                          +{bet.payout}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {match.userBets.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">{t("betLocked")}</p>
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
            onSuccess={() => onOpenChange(false)}
          />
        ) : (
          <p className="text-center text-sm text-muted-foreground">{t("noBet")}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
