"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { TokenIcon } from "@/components/token-icon";
import { computeMatchStats, type DistributionSlice, type Outcome1x2 } from "@/lib/match-stats";
import type { GroupMemberBet } from "@/queries/bets";

interface MatchStatsTabProps {
  bets: GroupMemberBet[];
  homeScore: number | null;
  awayScore: number | null;
  isFinished: boolean;
}

/** Compact token formatting: 48500 → "48.5k". */
function formatTokens(n: number): string {
  if (n >= 10000) return `${Math.round(n / 100) / 10}k`;
  return String(n);
}

const OUTCOME_COLOR: Record<Outcome1x2, string> = {
  "1": "#10b981",
  X: "#9ca3af",
  "2": "#ef4444",
};

function StatLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 px-0.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
      {children}
    </div>
  );
}

function KeyValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-border/50 border-b py-1 text-xs last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="inline-flex items-center gap-1 font-medium font-mono">{children}</span>
    </div>
  );
}

/** A single horizontal bar split into 1/X/2 segments sized by `metric`. */
function StackedBar({
  slices,
  metric,
}: {
  slices: DistributionSlice[];
  metric: (slice: DistributionSlice) => number;
}) {
  const total = slices.reduce((sum, s) => sum + metric(s), 0);

  if (total === 0) {
    return <div className="h-5 rounded-md bg-muted" />;
  }

  return (
    <div className="flex h-5 overflow-hidden rounded-md">
      {slices.map((slice) => {
        const value = metric(slice);
        if (value === 0) return null;
        return (
          <div
            key={slice.key}
            className="h-full min-w-[3px]"
            style={{ flex: value, backgroundColor: OUTCOME_COLOR[slice.key] }}
          />
        );
      })}
    </div>
  );
}

export function MatchStatsTab({ bets, homeScore, awayScore, isFinished }: MatchStatsTabProps) {
  const t = useTranslations("matches");

  const stats = useMemo(
    () => computeMatchStats(bets, { homeScore, awayScore, isFinished }),
    [bets, homeScore, awayScore, isFinished],
  );

  if (bets.length === 0) {
    return <p className="py-2 text-center text-muted-foreground text-xs">{t("noBetsYet")}</p>;
  }

  const biggestBet =
    (stats.biggestStakeBetId && bets.find((b) => b.betId === stats.biggestStakeBetId)) || null;

  return (
    <div className="flex flex-col gap-4">
      {/* 1-X-2 megoszlás: két stacked sáv (fő szerint és tét szerint) + legend */}
      <section>
        <StatLabel>{t("statDistribution")}</StatLabel>

        <div className="mb-0.5 flex items-center gap-1 px-0.5 text-[10px] text-muted-foreground">
          {t("statDistByCount")} · {t("statPlayers", { count: stats.betCount })}
        </div>
        <StackedBar slices={stats.distribution} metric={(s) => s.count} />

        <div className="mt-2 mb-0.5 flex items-center gap-1 px-0.5 text-[10px] text-muted-foreground">
          {t("statDistByStake")} · {formatTokens(stats.totalStake)}
          <TokenIcon size={9} />
        </div>
        <StackedBar slices={stats.distribution} metric={(s) => s.totalStake} />

        <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
          {stats.distribution.map((slice) => (
            <span
              key={slice.key}
              className="inline-flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground tabular-nums"
            >
              <span
                className="size-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: OUTCOME_COLOR[slice.key] }}
              />
              <span className="font-semibold text-foreground">{slice.key}</span>·{" "}
              {t("statPlayers", { count: slice.count })} · {formatTokens(slice.totalStake)}
              <TokenIcon size={9} />
            </span>
          ))}
        </div>
      </section>

      {/* Eredmény-tippek */}
      <section>
        <StatLabel>{t("statResultTips")}</StatLabel>
        <KeyValue label={t("statMostCommonTip")}>
          {stats.mostCommonTip
            ? t("statTipWithCount", {
                home: stats.mostCommonTip.home,
                away: stats.mostCommonTip.away,
                count: stats.mostCommonTip.count,
              })
            : "—"}
        </KeyValue>
        <KeyValue label={t("statAvgTip")}>
          {stats.avgTip ? `${stats.avgTip.home} – ${stats.avgTip.away}` : "—"}
        </KeyValue>
        {stats.exactCorrectCount !== null && (
          <KeyValue label={t("statExactCorrect")}>
            {t("statPlayers", { count: stats.exactCorrectCount })} 🎯
          </KeyValue>
        )}
        {stats.winnerCorrectCount !== null && (
          <KeyValue label={t("statWinnerCorrect")}>
            {t("statPlayersOf", { count: stats.winnerCorrectCount, total: stats.betCount })}
          </KeyValue>
        )}
      </section>

      {/* Tét */}
      <section>
        <StatLabel>{t("statStake")}</StatLabel>
        {biggestBet && (
          <KeyValue label={t("statBiggestStake")}>
            {biggestBet.userDisplayName ?? biggestBet.userName} · {formatTokens(biggestBet.stake)}
            <TokenIcon size={10} />
          </KeyValue>
        )}
        <KeyValue label={t("statTotalStake")}>
          {formatTokens(stats.totalStake)}
          <TokenIcon size={10} />
        </KeyValue>
        <KeyValue label={t("statAvgStake")}>
          {formatTokens(stats.avgStake)}
          <TokenIcon size={10} />
        </KeyValue>
      </section>
    </div>
  );
}
