"use client";

import { Circle, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { getMatchGroupBets } from "@/actions/live";
import { BetForm } from "@/components/bet-form";
import { GroupCard } from "@/components/group-card";
import type { MatchCardData } from "@/components/match-card";
import { PublicGroupDialog } from "@/components/public-group-dialog";
import { TokenIcon } from "@/components/token-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import type { GroupBetsForMatch, GroupMemberBet } from "@/queries/bets";
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

function sortBets(bets: GroupMemberBet[], currentUserId: string, isFinished: boolean) {
  return [...bets].sort((a, b) => {
    if (a.userId === currentUserId) return -1;
    if (b.userId === currentUserId) return 1;
    if (isFinished) {
      const profitA = (a.payout ?? 0) - a.stake;
      const profitB = (b.payout ?? 0) - b.stake;
      return profitB - profitA;
    }
    return b.stake - a.stake;
  });
}

function BetRow({
  bet,
  isCurrentUser,
  isFinished,
  youLabel,
}: {
  bet: GroupMemberBet;
  isCurrentUser: boolean;
  isFinished: boolean;
  youLabel: string;
}) {
  const isWin = isFinished && bet.result1x2Correct === true;
  const isLoss = isFinished && bet.result1x2Correct === false;

  const rowBg = isCurrentUser
    ? isWin
      ? "bg-emerald-500/15"
      : isLoss
        ? "bg-destructive/15"
        : "bg-accent"
    : isWin
      ? "bg-emerald-500/5"
      : isLoss
        ? "bg-destructive/5"
        : "bg-muted/50";

  const textColor = isWin
    ? "text-emerald-600 dark:text-emerald-400"
    : isLoss
      ? "text-destructive"
      : "text-foreground";

  const netProfit = bet.payout != null ? bet.payout - bet.stake : null;
  const netColor =
    netProfit == null
      ? "text-muted-foreground"
      : netProfit > 0
        ? "text-emerald-600 dark:text-emerald-400"
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

  const displayName = isCurrentUser ? youLabel : (bet.userDisplayName ?? bet.userName);

  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 ${rowBg} ${
        isCurrentUser ? "border-foreground/40 border-l-2" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Avatar className="size-5 shrink-0">
          <AvatarImage src={bet.userAvatarUrl ?? undefined} alt={displayName} />
          <AvatarFallback className="font-mono text-[9px]">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span
          className={`truncate text-xs ${
            isCurrentUser ? "font-semibold" : "text-muted-foreground"
          }`}
        >
          {displayName}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={`font-bold font-mono text-sm tabular-nums ${textColor}`}>
          {bet.predictedHome}-{bet.predictedAway}
        </span>
        <span className="inline-flex items-center gap-0.5 font-mono text-muted-foreground text-xs">
          {bet.stake}
          <TokenIcon size={10} />
        </span>
        {netLabel != null && (
          <Badge variant="outline" className={`font-mono text-[10px] ${netColor}`}>
            {netLabel}
          </Badge>
        )}
      </div>
    </div>
  );
}

function GroupBetsSection({
  group,
  currentUserId,
  isFinished,
  youLabel,
  noBetLabel,
}: {
  group: GroupBetsForMatch;
  currentUserId: string;
  isFinished: boolean;
  youLabel: string;
  noBetLabel: string;
}) {
  const sortedBets = useMemo(
    () => sortBets(group.bets, currentUserId, isFinished),
    [group.bets, currentUserId, isFinished],
  );

  const hasOwnBet = sortedBets.some((b) => b.userId === currentUserId);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="px-1 font-medium text-muted-foreground text-xs uppercase tracking-wider">
        {group.groupName}
      </div>
      <div className="flex flex-col gap-1">
        {!hasOwnBet && (
          <div className="flex items-center justify-between gap-2 rounded-md border border-dashed px-2.5 py-1.5">
            <span className="font-semibold text-muted-foreground text-xs">{youLabel}</span>
            <span className="text-muted-foreground/60 text-xs italic">{noBetLabel}</span>
          </div>
        )}
        {sortedBets.map((bet) => (
          <BetRow
            key={bet.betId}
            bet={bet}
            isCurrentUser={bet.userId === currentUserId}
            isFinished={isFinished}
            youLabel={youLabel}
          />
        ))}
      </div>
    </div>
  );
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

          {matchStarted ? (
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
              ) : (
                <div className="flex flex-col gap-3">
                  {groupBetsData.map((group) => (
                    <GroupBetsSection
                      key={group.groupId}
                      group={group}
                      currentUserId={currentUserId}
                      isFinished={isFinished}
                      youLabel={t("youLabel")}
                      noBetLabel={t("noBetInGroup")}
                    />
                  ))}
                </div>
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
