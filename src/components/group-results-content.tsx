"use client";

import { useTranslations } from "next-intl";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";

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
}

function TeamLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  if (logoUrl) {
    return <img src={logoUrl} alt={name} className="size-5 object-contain" />;
  }
  return (
    <span className="flex size-5 items-center justify-center rounded bg-muted font-mono text-[8px] font-bold">
      {name.slice(0, 3).toUpperCase()}
    </span>
  );
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
}: GroupResultsContentProps) {
  const t = useTranslations("groups");
  const tBetting = useTranslations("betting");

  // Group bets by matchId
  const betsByMatch = new Map<string, GroupBet[]>();
  for (const bet of bets) {
    const existing = betsByMatch.get(bet.matchId) ?? [];
    betsByMatch.set(bet.matchId, [...existing, bet]);
  }

  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          {t("noBetsYet")}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Accordion type="multiple">
          {matches.map((match) => {
            const matchBets = betsByMatch.get(match.id) ?? [];
            const sortedBets = [...matchBets].sort(
              (a, b) => (b.payout ?? 0) - (a.payout ?? 0),
            );

            return (
              <AccordionItem key={match.id} value={match.id}>
                <AccordionTrigger className="px-3 py-2.5 hover:no-underline">
                  <div className="flex flex-1 items-center gap-2">
                    <TeamLogo
                      name={match.homeTeam.name}
                      logoUrl={match.homeTeam.logoUrl}
                    />
                    <span className="font-mono text-sm font-bold tabular-nums">
                      {match.homeScore}-{match.awayScore}
                    </span>
                    <TeamLogo
                      name={match.awayTeam.name}
                      logoUrl={match.awayTeam.logoUrl}
                    />
                    <span className="ml-auto text-xs text-muted-foreground">
                      {t("betCount", {
                        count: matchBets.length,
                        total: memberCount,
                      })}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {sortedBets.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      {t("noBetsYet")}
                    </p>
                  ) : (
                    <div className="flex flex-col">
                      {/* Header */}
                      <div className="flex items-center gap-2 px-3 pb-1 text-[11px] font-medium text-muted-foreground">
                        <span className="flex-1">
                          {/* player column */}
                        </span>
                        <span className="w-10 text-center">
                          {t("prediction")}
                        </span>
                        <span className="w-10 text-right">
                          {tBetting("stake")}
                        </span>
                        <span className="w-12 text-right">{t("payout")}</span>
                      </div>
                      {/* Rows */}
                      {sortedBets.map((bet) => {
                        const isCurrentUser = bet.userId === currentUserId;
                        const won =
                          bet.result1x2Correct === true && bet.payout != null;
                        const netProfit = won && bet.payout != null
                          ? bet.payout - bet.stake
                          : -(bet.stake);

                        return (
                          <div
                            key={bet.userId}
                            className={`flex items-center gap-2 px-3 py-1.5 ${
                              isCurrentUser
                                ? "bg-amber-500/5 ring-1 ring-inset ring-amber-500/20"
                                : ""
                            }`}
                          >
                            {/* Player */}
                            <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
                              <Avatar className="size-5">
                                <AvatarImage
                                  src={bet.userAvatarUrl ?? undefined}
                                />
                                <AvatarFallback className="text-[9px]">
                                  {initials(bet.userName)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate text-xs">
                                {bet.userName}
                              </span>
                            </div>
                            {/* Prediction */}
                            <span
                              className={`w-10 text-center font-mono text-xs font-medium ${
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
                            {/* Stake */}
                            <span className="w-10 text-right font-mono text-xs text-muted-foreground">
                              {bet.stake}
                            </span>
                            {/* Net profit */}
                            <span
                              className={`w-12 text-right font-mono text-xs font-bold ${
                                netProfit > 0
                                  ? "text-emerald-500"
                                  : "text-destructive"
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
  );
}
