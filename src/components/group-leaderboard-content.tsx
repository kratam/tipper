"use client";

import { ChevronDown, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Accordion as AccordionPrimitive } from "radix-ui";
import { useMemo, useState } from "react";
import { BetBonusCell } from "@/components/bet-bonus-cell";
import { LeaderboardBadges } from "@/components/leaderboard-badges";
import { TeamLogo } from "@/components/team-logo";
import { Accordion, AccordionContent, AccordionItem } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { Link } from "@/i18n/navigation";
import { predictionToneClass } from "@/lib/bet-display";
import { formatEffectiveOdds } from "@/lib/odds-display";

interface LeaderboardRow {
  rank: number;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  gravatarHash: string | null;
  profit: number;
  officialRank?: number;
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
  userBadges?: Record<string, Array<{ badgeKey: string; tier: number }>>;
}

function medalFor(rank: number): string | null {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

export function GroupLeaderboardContent({
  leaderboard,
  finishedMatches,
  bets,
  currentUserId,
  oddsBoost,
  userBadges = {},
}: GroupLeaderboardContentProps) {
  const t = useTranslations("groups");
  const tCircles = useTranslations("circles");
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
      <Accordion type="multiple" value={openItems} onValueChange={setOpenItems} className="gap-2">
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

          const medal = medalFor(row.rank);

          return (
            <AccordionItem
              key={row.userId}
              value={row.userId}
              className={`overflow-hidden rounded-sm border shadow-card ${
                isCurrentUser ? "border-gold-line bg-gold-soft" : "border-border bg-card"
              }`}
            >
              <AccordionPrimitive.Header
                className={`flex items-center transition-colors ${
                  isCurrentUser ? "" : "hover:bg-secondary"
                }`}
              >
                {/* rank */}
                <span
                  className={`min-w-[26px] shrink-0 pl-3 font-bold font-mono text-faint ${
                    medal ? "text-[16px]" : ""
                  }`}
                >
                  {medal ?? `#${row.rank}`}
                </span>
                {/* avatar as profile link */}
                <Link href={`/u/${row.userId}`} className="mx-2.5 flex shrink-0 py-2.5">
                  <UserAvatar
                    name={row.userName}
                    googleAvatarUrl={row.userAvatarUrl}
                    gravatarHash={row.gravatarHash}
                    className="size-7"
                    fallbackClassName="text-xs"
                  />
                </Link>
                {/* accordion toggle: name, badges, profit, chevron */}
                <AccordionPrimitive.Trigger className="group/acc flex flex-1 items-center gap-2.5 py-2.5 pr-3 text-left outline-none">
                  <span className="flex-1 truncate font-semibold text-[14px]">{row.userName}</span>
                  <LeaderboardBadges badges={userBadges[row.userId] ?? []} />
                  {row.officialRank != null && (
                    <span className="flex-none rounded-full bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-faint">
                      {tCircles("officialRankBadge", { rank: row.officialRank })}
                    </span>
                  )}
                  <span
                    className={`font-bold font-mono text-[14px] ${
                      row.profit > 0 ? "text-win" : row.profit < 0 ? "text-loss" : "text-faint"
                    }`}
                  >
                    {row.profit > 0 ? "+" : ""}
                    {row.profit}
                  </span>
                  <ChevronDown className="size-4 flex-none text-faint transition-transform group-aria-expanded/acc:rotate-180" />
                </AccordionPrimitive.Trigger>
              </AccordionPrimitive.Header>
              <AccordionContent className="border-border border-t bg-card p-3">
                {orderedUserBets.length === 0 ? (
                  <p className="text-faint text-xs">{t("noBetsForPlayer")}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="flex min-w-[360px] flex-col">
                      {/* Sub-header */}
                      <div className="flex items-center gap-2 pb-1 font-medium text-[11px] text-muted-foreground">
                        <span className="flex-1">{/* match column */}</span>
                        <span className="w-10 text-center">{t("prediction")}</span>
                        <span className="w-10 text-right">{t("odds")}</span>
                        <span className="w-10 text-right">{tBetting("stake")}</span>
                        <span className="w-10 text-right">{t("bonusColumn")}</span>
                        <span className="w-12 text-right">{t("payout")}</span>
                      </div>
                      {orderedUserBets.map(({ bet, match }) => {
                        // payout már tartalmazza a vesztés-visszatérítést (vesztésnél a tét egy
                        // hányada), így a nettó mindig payout - stake.
                        const netProfit = bet.payout != null ? bet.payout - bet.stake : -bet.stake;
                        const lockedOdds = formatEffectiveOdds(bet.oddsAtBet, oddsBoost);

                        return (
                          <div key={bet.matchId} className="flex items-center gap-2 py-1.5">
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
