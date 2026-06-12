"use client";

import { ChevronDown, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Accordion as AccordionPrimitive } from "radix-ui";
import { useState } from "react";
import { BetBonusCell } from "@/components/bet-bonus-cell";
import { TeamLogo } from "@/components/team-logo";
import { Accordion, AccordionContent, AccordionItem } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { predictionToneClass } from "@/lib/bet-display";
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
      <Accordion type="multiple" value={openItems} onValueChange={setOpenItems} className="gap-2">
        {matches.map((match) => {
          const matchBets = betsByMatch.get(match.id) ?? [];
          const sortedBets = [...matchBets].sort((a, b) => (b.payout ?? 0) - (a.payout ?? 0));

          return (
            <AccordionItem
              key={match.id}
              value={match.id}
              className="overflow-hidden rounded-sm border border-border bg-card shadow-card"
            >
              <AccordionPrimitive.Header className="flex">
                <AccordionPrimitive.Trigger className="group/acc flex w-full items-center gap-2.5 p-2.5 px-3 text-left outline-none transition-colors hover:bg-secondary">
                  <TeamLogo name={match.homeTeam.name} logoUrl={match.homeTeam.logoUrl} size={20} />
                  <span className="font-extrabold font-mono text-[16px] tabular-nums">
                    {match.homeScore}-{match.awayScore}
                  </span>
                  <TeamLogo name={match.awayTeam.name} logoUrl={match.awayTeam.logoUrl} size={20} />
                  <span className="ml-auto text-muted-foreground text-xs">
                    {t("betCount", {
                      count: matchBets.length,
                      total: memberCount,
                    })}
                  </span>
                  <ChevronDown className="size-4 flex-none text-faint transition-transform group-aria-expanded/acc:rotate-180" />
                </AccordionPrimitive.Trigger>
              </AccordionPrimitive.Header>
              <AccordionContent className="border-border border-t bg-card p-3">
                {sortedBets.length === 0 ? (
                  <p className="text-faint text-xs">{t("noBetsYet")}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="flex min-w-[360px] flex-col">
                      {/* Header */}
                      <div className="flex items-center gap-2 pb-1 font-medium text-[11px] text-muted-foreground">
                        <span className="flex-1">{/* player column */}</span>
                        <span className="w-10 text-center">{t("prediction")}</span>
                        <span className="w-10 text-right">{t("odds")}</span>
                        <span className="w-10 text-right">{tBetting("stake")}</span>
                        <span className="w-10 text-right">{t("bonusColumn")}</span>
                        <span className="w-12 text-right">{t("payout")}</span>
                      </div>
                      {/* Rows */}
                      {sortedBets.map((bet) => {
                        const isCurrentUser = bet.userId === currentUserId;
                        // payout már tartalmazza a vesztés-visszatérítést (vesztésnél a tét egy
                        // hányada), így a nettó mindig payout - stake.
                        const netProfit = bet.payout != null ? bet.payout - bet.stake : -bet.stake;
                        const lockedOdds = formatEffectiveOdds(bet.oddsAtBet, oddsBoost);

                        return (
                          <div
                            key={bet.userId}
                            className={`flex items-center gap-2 rounded-sm px-1 py-1.5 ${
                              isCurrentUser ? "bg-gold-soft" : ""
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
                              className={`w-10 text-center font-mono text-xs ${predictionToneClass(bet)}`}
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
                            {/* Bonus */}
                            <BetBonusCell bet={bet} oddsBoost={oddsBoost} />
                            {/* Net profit */}
                            <span
                              className={`w-12 text-right font-bold font-mono text-xs ${
                                netProfit > 0 ? "text-win" : "text-loss"
                              }`}
                            >
                              {netProfit > 0 ? "+" : ""}
                              {netProfit}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
