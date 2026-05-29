"use client";

import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
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
  userName: string;
  userAvatarUrl: string | null;
  predictedHome: number;
  predictedAway: number;
  stake: number;
  oddsAtBet: string | null;
  payout: number | null;
  result1x2Correct: boolean | null;
  goalDiffCorrect: boolean | null;
  exactScoreCorrect: boolean | null;
}

interface GroupResultsContentProps {
  matches: FinishedMatch[];
  bets: GroupBet[];
  currentUserId: string;
  memberCount: number;
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

export function GroupResultsContent({
  matches,
  bets,
  currentUserId,
  memberCount,
  oddsBoost,
}: GroupResultsContentProps) {
  const t = useTranslations("groups");
  const tBetting = useTranslations("betting");
  const [openItems, setOpenItems] = useState<string[]>([]);

  // Group bets by matchId
  const betsByMatch = new Map<string, GroupBet[]>();
  for (const bet of bets) {
    const existing = betsByMatch.get(bet.matchId) ?? [];
    betsByMatch.set(bet.matchId, [...existing, bet]);
  }

  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          {t("noBetsYet")}
        </CardContent>
      </Card>
    );
  }

  const allOpen = openItems.length === matches.length;
  const toggleAll = () => {
    setOpenItems(allOpen ? [] : matches.map((m) => m.id));
  };

  return (
    <div className="flex flex-col gap-2">
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
      <Card>
        <CardContent className="p-0">
          <Accordion type="multiple" value={openItems} onValueChange={setOpenItems}>
            {matches.map((match) => {
              const matchBets = betsByMatch.get(match.id) ?? [];
              const sortedBets = [...matchBets].sort((a, b) => (b.payout ?? 0) - (a.payout ?? 0));

              return (
                <AccordionItem key={match.id} value={match.id}>
                  <AccordionTrigger className="px-3 py-2.5 hover:no-underline">
                    <div className="flex flex-1 items-center gap-2">
                      <TeamLogo
                        name={match.homeTeam.name}
                        logoUrl={match.homeTeam.logoUrl}
                        size={20}
                      />
                      <span className="font-bold font-mono text-sm tabular-nums">
                        {match.homeScore}-{match.awayScore}
                      </span>
                      <TeamLogo
                        name={match.awayTeam.name}
                        logoUrl={match.awayTeam.logoUrl}
                        size={20}
                      />
                      <span className="ml-auto text-muted-foreground text-xs">
                        {t("betCount", {
                          count: matchBets.length,
                          total: memberCount,
                        })}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {sortedBets.length === 0 ? (
                      <p className="px-3 py-2 text-muted-foreground text-xs">{t("noBetsYet")}</p>
                    ) : (
                      <div className="flex flex-col">
                        {/* Header */}
                        <div className="flex items-center gap-2 px-3 pb-1 font-medium text-[11px] text-muted-foreground">
                          <span className="flex-1">{/* player column */}</span>
                          <span className="w-10 text-center">{t("prediction")}</span>
                          <span className="w-10 text-right">{t("odds")}</span>
                          <span className="w-10 text-right">{tBetting("stake")}</span>
                          <span className="w-12 text-right">{t("payout")}</span>
                        </div>
                        {/* Rows */}
                        {sortedBets.map((bet) => {
                          const isCurrentUser = bet.userId === currentUserId;
                          const won = bet.result1x2Correct === true && bet.payout != null;
                          const netProfit =
                            won && bet.payout != null ? bet.payout - bet.stake : -bet.stake;
                          const lockedOdds = formatEffectiveOdds(bet.oddsAtBet, oddsBoost);

                          return (
                            <div
                              key={bet.userId}
                              className={`flex items-center gap-2 px-3 py-1.5 ${
                                isCurrentUser
                                  ? "bg-amber-500/5 ring-1 ring-amber-500/20 ring-inset"
                                  : ""
                              }`}
                            >
                              {/* Player */}
                              <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
                                <Avatar className="size-5">
                                  <AvatarImage src={bet.userAvatarUrl ?? undefined} />
                                  <AvatarFallback className="text-[9px]">
                                    {initials(bet.userName)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="truncate text-xs">{bet.userName}</span>
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
