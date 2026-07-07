"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Accordion as AccordionPrimitive } from "radix-ui";
import { useCallback, useMemo, useState } from "react";
import { loadProfileTournamentBets } from "@/actions/profile";
import { BetBonusCell } from "@/components/bet-bonus-cell";
import { TeamLogo } from "@/components/team-logo";
import { Accordion, AccordionContent, AccordionItem } from "@/components/ui/accordion";
import { predictionToneClass } from "@/lib/bet-display";
import { formatEffectiveOdds } from "@/lib/odds-display";
import {
  netProfit,
  shouldShowGroupBadge,
  sortBetRowsByScheduledDesc,
  sortTournamentSummaries,
} from "@/lib/profile-bets";
import type { ProfileBetRow, TournamentBetSummary } from "@/queries/profile";

interface ProfileBetsSectionProps {
  profileUserId: string;
  summaries: TournamentBetSummary[];
  /** Az aktív tornák előre betöltött sorai (kulcs: tournamentId). */
  initialBets: Record<string, ProfileBetRow[]>;
}

export function ProfileBetsSection({
  profileUserId,
  summaries,
  initialBets,
}: ProfileBetsSectionProps) {
  const t = useTranslations("profile");
  const tGroups = useTranslations("groups");
  const tBetting = useTranslations("betting");

  const ordered = useMemo(() => sortTournamentSummaries(summaries), [summaries]);
  const activeIds = useMemo(
    () => ordered.filter((s) => s.status === "active").map((s) => s.tournamentId),
    [ordered],
  );

  const [openItems, setOpenItems] = useState<string[]>(activeIds);
  const [betsByTournament, setBetsByTournament] =
    useState<Record<string, ProfileBetRow[]>>(initialBets);
  const [loadingIds, setLoadingIds] = useState<string[]>([]);

  const handleValueChange = useCallback(
    (next: string[]) => {
      setOpenItems(next);
      for (const tid of next) {
        if (betsByTournament[tid] || loadingIds.includes(tid)) continue;
        setLoadingIds((prev) => [...prev, tid]);
        loadProfileTournamentBets(profileUserId, tid)
          .then((rows) => {
            setBetsByTournament((prev) => ({ ...prev, [tid]: rows }));
          })
          .finally(() => {
            setLoadingIds((prev) => prev.filter((id) => id !== tid));
          });
      }
    },
    [betsByTournament, loadingIds, profileUserId],
  );

  return (
    <section>
      <h2 className="mb-4 font-bold font-heading text-lg">{t("betsHeading")}</h2>
      <Accordion
        type="multiple"
        value={openItems}
        onValueChange={handleValueChange}
        className="gap-2"
      >
        {ordered.map((summary) => {
          const rows = betsByTournament[summary.tournamentId];
          const isLoading = rows === undefined && loadingIds.includes(summary.tournamentId);
          const showGroupBadge = shouldShowGroupBadge(summary.distinctGroupCount);

          return (
            <AccordionItem
              key={summary.tournamentId}
              value={summary.tournamentId}
              className="overflow-hidden rounded-sm border border-border bg-card shadow-card"
            >
              <AccordionPrimitive.Header className="flex items-center transition-colors hover:bg-secondary">
                <AccordionPrimitive.Trigger className="group/acc flex flex-1 items-center gap-2.5 py-2.5 pr-3 pl-3 text-left outline-none">
                  <TournamentLogo name={summary.name} logoUrl={summary.logoUrl} />
                  <span className="flex-1 truncate font-semibold text-[14px]">{summary.name}</span>
                  <span className="flex-none font-mono text-[11px] text-faint">
                    {t("summaryBetsCount", { count: summary.betCount })}
                  </span>
                  <span className="flex-none font-mono text-[11px] text-muted-foreground">
                    {summary.hitRate}%
                  </span>
                  <span
                    className={`flex-none font-bold font-mono text-[14px] ${
                      summary.profit > 0
                        ? "text-win"
                        : summary.profit < 0
                          ? "text-loss"
                          : "text-faint"
                    }`}
                  >
                    {summary.profit > 0 ? "+" : ""}
                    {summary.profit}
                  </span>
                  <ChevronDown className="size-4 flex-none text-faint transition-transform group-aria-expanded/acc:rotate-180" />
                </AccordionPrimitive.Trigger>
              </AccordionPrimitive.Header>
              <AccordionContent className="border-border border-t bg-card p-3">
                {isLoading || rows === undefined ? (
                  <BetRowsSkeleton />
                ) : (
                  <BetRowsTable
                    rows={rows}
                    showGroupBadge={showGroupBadge}
                    labels={{
                      prediction: tGroups("prediction"),
                      odds: tGroups("odds"),
                      stake: tBetting("stake"),
                      bonus: tGroups("bonusColumn"),
                      payout: tGroups("payout"),
                    }}
                  />
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </section>
  );
}

function BetRowsTable({
  rows,
  showGroupBadge,
  labels,
}: {
  rows: ProfileBetRow[];
  showGroupBadge: boolean;
  labels: { prediction: string; odds: string; stake: string; bonus: string; payout: string };
}) {
  const ordered = useMemo(() => sortBetRowsByScheduledDesc(rows), [rows]);

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[360px] flex-col">
        {/* Sub-header */}
        <div className="flex items-center gap-2 pb-1 font-medium text-[11px] text-muted-foreground">
          <span className="flex-1">{/* match column */}</span>
          <span className="w-10 text-center">{labels.prediction}</span>
          <span className="w-10 text-right">{labels.odds}</span>
          <span className="w-10 text-right">{labels.stake}</span>
          <span className="w-10 text-right">{labels.bonus}</span>
          <span className="w-12 text-right">{labels.payout}</span>
        </div>
        {ordered.map((bet) => {
          const net = netProfit(bet.payout, bet.stake);
          const lockedOdds = formatEffectiveOdds(bet.oddsAtBet, bet.oddsBoost);
          return (
            <div key={`${bet.matchId}-${bet.groupId}`} className="flex items-center gap-2 py-1.5">
              {/* Match */}
              <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
                <TeamLogo name={bet.homeTeam.name} logoUrl={bet.homeTeam.logoUrl} size={20} />
                <span className="font-bold font-mono text-xs tabular-nums">
                  {bet.homeScore}-{bet.awayScore}
                </span>
                <TeamLogo name={bet.awayTeam.name} logoUrl={bet.awayTeam.logoUrl} size={20} />
                {showGroupBadge && (
                  <span className="ml-1 truncate rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-faint">
                    {bet.groupName}
                  </span>
                )}
              </div>
              {/* Prediction */}
              <span className={`w-10 text-center font-mono text-xs ${predictionToneClass(bet)}`}>
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
              <BetBonusCell bet={bet} oddsBoost={bet.oddsBoost} />
              {/* Net profit */}
              <span
                className={`w-12 text-right font-bold font-mono text-xs ${
                  net > 0 ? "text-win" : "text-loss"
                }`}
              >
                {net > 0 ? "+" : ""}
                {net}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Torna-embléma a fejlécben. Sima `<img>` (nem `next/image`), mert a torna-logók
 * tetszőleges külső hostról jönnek (pl. wikimedia), amit a next/image nem enged.
 * Logó híján 2 betűs monogram fallback.
 */
function TournamentLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  if (logoUrl) {
    return (
      // biome-ignore lint/performance/noImgElement: külső, nem-listázott host — next/image nem opció
      <img src={logoUrl} alt={name} className="size-6 flex-none rounded-[3px] object-contain" />
    );
  }
  return (
    <span className="flex size-6 flex-none items-center justify-center rounded-[3px] bg-muted font-bold font-mono text-[10px] leading-none">
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function BetRowsSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-5 animate-pulse rounded bg-surface-2" />
      ))}
    </div>
  );
}
