"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { TokenIcon } from "@/components/token-icon";
import { computeMatchStats, type Outcome1x2 } from "@/lib/match-stats";
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
      {/* 1-X-2 megoszlás */}
      <section>
        <StatLabel>{t("statDistribution")}</StatLabel>
        <div className="flex flex-col gap-1.5">
          {stats.distribution.map((slice) => (
            <div key={slice.key} className="flex items-center gap-2 text-[11px]">
              <span
                className="w-3.5 text-center font-bold"
                style={{ color: OUTCOME_COLOR[slice.key] }}
              >
                {slice.key}
              </span>
              <div className="h-3.5 flex-1 overflow-hidden rounded bg-muted">
                <div
                  className="h-full rounded"
                  style={{ width: `${slice.pct}%`, backgroundColor: OUTCOME_COLOR[slice.key] }}
                />
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] text-muted-foreground tabular-nums">
                {t("statPlayers", { count: slice.count })} · {formatTokens(slice.totalStake)}
                <TokenIcon size={9} />
              </span>
            </div>
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
