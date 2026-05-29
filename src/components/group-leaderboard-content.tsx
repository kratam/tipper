"use client";

import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { TeamLogo } from "@/components/team-logo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatEffectiveOdds } from "@/lib/odds-display";

interface LeaderboardRow {
  rank: number;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  profit: number;
}

interface FinishedMatch {
  id: string;
  homeTeam: { name: string; logoUrl: string | null };
  awayTeam: { name: string; logoUrl: string | null };
  homeScore: number | null;
  awayScore: number | null;
  scheduledAt: string;
  round: string;
}

interface GroupBet {
  matchId: string;
  userId: string;
  predictedHome: number;
  predictedAway: number;
  stake: number;
  oddsAtBet: string | null;
  payout: number | null;
  result1x2Correct: boolean | null;
  goalDiffCorrect: boolean | null;
  exactScoreCorrect: boolean | null;
}

interface GroupLeaderboardContentProps {
  leaderboard: LeaderboardRow[];
  finishedMatches: FinishedMatch[];
  bets: GroupBet[];
  currentUserId: string;
  oddsBoost: number;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function GroupLeaderboardContent({
  leaderboard,
  finishedMatches,
  bets,
  currentUserId,
  oddsBoost,
}: GroupLeaderboardContentProps) {
  const t = useTranslations("groups");
  const tLeaderboard = useTranslations("leaderboard");
  const tBetting = useTranslations("betting");
  const [openItems, setOpenItems] = useState<string[]>([]);

  const matchById = useMemo(() => {
    const map = new Map<string, FinishedMatch>();
    for (const m of finishedMatches) map.set(m.id, m);
    return map;
  }, [finishedMatches]);

  const orderedMatchIds = useMemo(() => {
    return [...finishedMatches]
      .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
      .map((m) => m.id);
  }, [finishedMatches]);

  const betsByUser = useMemo(() => {
    const map = new Map<string, GroupBet[]>();
    for (const bet of bets) {
      if (!matchById.has(bet.matchId)) continue;
      const existing = map.get(bet.userId) ?? [];
      map.set(bet.userId, [...existing, bet]);
    }
    return map;
  }, [bets, matchById]);

  const hasAnyBets = bets.length > 0 && finishedMatches.length > 0;
  const allOpen = hasAnyBets && openItems.length === leaderboard.length;
  const toggleAll = () => {
    setOpenItems(allOpen ? [] : leaderboard.map((row) => row.userId));
  };

  return (
    <div className="flex flex-col gap-2">
      {hasAnyBets && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleAll}
            className="h-7 text-muted-foreground text-xs"
          >
            {allOpen ? (
              <ChevronsDownUp className="size-3.5" />
            ) : (
              <ChevronsUpDown className="size-3.5" />
            )}
            {allOpen ? t("collapseAll") : t("expandAll")}
          </Button>
        </div>
      )}
      <Card>
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex items-center gap-4 border-border border-b px-4 py-3 font-medium text-muted-foreground text-xs">
            <span className="w-10">{tLeaderboard("rank")}</span>
            <span className="flex-1">{tLeaderboard("player")}</span>
            <span className="w-20 text-right font-mono">{tLeaderboard("profit")}</span>
          </div>
          <Accordion type="multiple" value={openItems} onValueChange={setOpenItems}>
            {leaderboard.map((row) => {
              const isCurrentUser = row.userId === currentUserId;
              const userBets = betsByUser.get(row.userId) ?? [];

              const userBetsByMatch = new Map<string, GroupBet>();
              for (const bet of userBets) userBetsByMatch.set(bet.matchId, bet);

              const orderedUserBets = orderedMatchIds
                .map((id) => {
                  const bet = userBetsByMatch.get(id);
                  const match = matchById.get(id);
                  if (!bet || !match) return null;
                  return { bet, match };
                })
                .filter((x): x is { bet: GroupBet; match: FinishedMatch } => x !== null);

              return (
                <AccordionItem key={row.userId} value={row.userId}>
                  <AccordionTrigger
                    className={`px-4 py-3 hover:no-underline ${
                      isCurrentUser ? "bg-amber-500/5 ring-1 ring-amber-500/20 ring-inset" : ""
                    }`}
                  >
                    <div className="flex flex-1 items-center gap-4">
                      <span className="w-10 text-left font-bold font-mono text-sm">
                        #{row.rank}
                      </span>
                      <div className="flex flex-1 items-center gap-2">
                        <Avatar className="size-6">
                          <AvatarImage src={row.userAvatarUrl ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {initials(row.userName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{row.userName}</span>
                      </div>
                      <span className="w-20 text-right font-bold font-mono text-amber-500 text-sm">
                        {row.profit}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {orderedUserBets.length === 0 ? (
                      <p className="px-4 pb-2 text-muted-foreground text-xs">
                        {t("noBetsForPlayer")}
                      </p>
                    ) : (
                      <div className="flex flex-col">
                        {/* Sub-header */}
                        <div className="flex items-center gap-2 px-4 pb-1 font-medium text-[11px] text-muted-foreground">
                          <span className="flex-1">{/* match column */}</span>
                          <span className="w-10 text-center">{t("prediction")}</span>
                          <span className="w-10 text-right">{t("odds")}</span>
                          <span className="w-10 text-right">{tBetting("stake")}</span>
                          <span className="w-12 text-right">{t("payout")}</span>
                        </div>
                        {orderedUserBets.map(({ bet, match }) => {
                          const won = bet.result1x2Correct === true && bet.payout != null;
                          const netProfit =
                            won && bet.payout != null ? bet.payout - bet.stake : -bet.stake;
                          const lockedOdds = formatEffectiveOdds(bet.oddsAtBet, oddsBoost);

                          return (
                            <div key={bet.matchId} className="flex items-center gap-2 px-4 py-1.5">
                              {/* Match */}
                              <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
                                <TeamLogo
                                  name={match.homeTeam.name}
                                  logoUrl={match.homeTeam.logoUrl}
                                  size={20}
                                />
                                <span className="font-bold font-mono text-xs tabular-nums">
                                  {match.homeScore}-{match.awayScore}
                                </span>
                                <TeamLogo
                                  name={match.awayTeam.name}
                                  logoUrl={match.awayTeam.logoUrl}
                                  size={20}
                                />
                              </div>
                              {/* Prediction */}
                              <span
                                className={`w-10 text-center font-medium font-mono text-xs ${
                                  bet.exactScoreCorrect
                                    ? "text-amber-500"
                                    : bet.goalDiffCorrect
                                      ? "text-emerald-500"
                                      : bet.result1x2Correct
                                        ? "text-emerald-500/70"
                                        : "text-destructive/70"
                                }`}
                              >
                                {bet.predictedHome}-{bet.predictedAway}
                              </span>
                              {/* Odds */}
                              <span className="w-10 text-right font-mono text-muted-foreground text-xs">
                                {lockedOdds ?? "—"}
                              </span>
                              {/* Stake */}
                              <span className="w-10 text-right font-mono text-muted-foreground text-xs">
                                {bet.stake}
                              </span>
                              {/* Net profit */}
                              <span
                                className={`w-12 text-right font-bold font-mono text-xs ${
                                  netProfit > 0 ? "text-emerald-500" : "text-destructive"
                                }`}
                              >
                                {netProfit > 0 ? "+" : ""}
                                {netProfit}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
