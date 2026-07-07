"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { TokenIcon } from "@/components/token-icon";
import {
  type BonusPoolLevel,
  computeBonusPoolLevel,
  computeMatchStats,
  type DistributionSlice,
} from "@/lib/match-stats";
import { OUTCOME_GRADIENT } from "@/lib/outcome-colors";
import type { GroupMemberBet } from "@/queries/bets";

interface MatchStatsTabProps {
  bets: GroupMemberBet[];
  homeScore: number | null;
  awayScore: number | null;
  isFinished: boolean;
  poolBase: number;
  bonusGoalDiffPct: number;
  bonusExactScorePct: number;
}

/** Compact token formatting: 48500 → "48.5k". */
function formatTokens(n: number): string {
  if (n >= 10000) return `${Math.round(n / 100) / 10}k`;
  return String(n);
}

function StatLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 px-0.5 font-bold text-[10px] text-faint uppercase tracking-[0.12em]">
      {children}
    </div>
  );
}

function KeyValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-border border-b py-[7px] text-[13px] last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="inline-flex items-center gap-1.5 font-mono font-semibold">{children}</span>
    </div>
  );
}

/**
 * Egy bónusz-pool sora: `keret ◉` élőn, lezártnál `keret ◉ · N fő · +egy főre`.
 * A kifizetés arany (mint a Tippek-sor bónusza); 0 találónál „nincs találó".
 */
function BonusPoolRow({ label, level }: { label: string; level: BonusPoolLevel }) {
  const t = useTranslations("matches");
  return (
    <KeyValue label={label}>
      {formatTokens(level.pool)}
      <TokenIcon size={10} />
      {level.hitters != null &&
        (level.hitters > 0 ? (
          <>
            <span className="font-normal text-muted-foreground">
              · {t("statPlayers", { count: level.hitters })} ·
            </span>
            <span className="text-gold-text">+{formatTokens(level.perHitter ?? 0)}</span>
          </>
        ) : (
          <span className="font-normal text-muted-foreground">· {t("noHitters")}</span>
        ))}
    </KeyValue>
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
    return <div className="h-[30px] rounded-lg bg-surface-3" />;
  }

  return (
    <div className="flex h-[30px] gap-1">
      {slices.map((slice) => {
        const value = metric(slice);
        if (value === 0) return null;
        return (
          <div
            key={slice.key}
            className="flex min-w-[7px] items-center justify-center overflow-hidden rounded-[7px] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.14)]"
            style={{ flex: value, background: OUTCOME_GRADIENT[slice.key] }}
          >
            <span className="font-extrabold font-mono text-[11px] text-white [text-shadow:0_1px_1.5px_rgba(0,0,0,0.4)]">
              {slice.key}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function MatchStatsTab({
  bets,
  homeScore,
  awayScore,
  isFinished,
  poolBase,
  bonusGoalDiffPct,
  bonusExactScorePct,
}: MatchStatsTabProps) {
  const t = useTranslations("matches");

  const stats = useMemo(
    () => computeMatchStats(bets, { homeScore, awayScore, isFinished }),
    [bets, homeScore, awayScore, isFinished],
  );

  // Bónusz-poolok: a keret élőn is fix (a tétek a kezdéskor véglegesednek), az
  // egy főre eső kifizetés csak lezárt meccsnél ismert. A találókat a scoring
  // flag-ekből számoljuk; élő meccsen (null) csak a keret látszik.
  const goalDiffHitters = isFinished ? bets.filter((b) => b.goalDiffCorrect === true).length : null;
  const exactScoreHitters = isFinished
    ? bets.filter((b) => b.exactScoreCorrect === true).length
    : null;
  const goalDiffPool = computeBonusPoolLevel(poolBase, bonusGoalDiffPct, goalDiffHitters);
  const exactScorePool = computeBonusPoolLevel(poolBase, bonusExactScorePct, exactScoreHitters);

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

        <div className="mb-1.5 flex items-center gap-1 px-0.5 text-[10.5px] text-muted-foreground">
          {t("statDistByCount")} · {t("statPlayers", { count: stats.betCount })}
        </div>
        <StackedBar slices={stats.distribution} metric={(s) => s.count} />

        <div className="mt-2 mb-1.5 flex items-center gap-1 px-0.5 text-[10.5px] text-muted-foreground">
          {t("statDistByStake")} · {formatTokens(stats.totalStake)}
          <TokenIcon size={9} />
        </div>
        <StackedBar slices={stats.distribution} metric={(s) => s.totalStake} />

        <div className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1.5">
          {stats.distribution.map((slice) => (
            <span
              key={slice.key}
              className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-muted-foreground tabular-nums"
            >
              <span
                className="size-[9px] shrink-0 rounded-[3px] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
                style={{ background: OUTCOME_GRADIENT[slice.key] }}
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

      {/* Bónusz poolok: a keret (élőn is), lezártnál az egy főre eső kifizetés */}
      {(goalDiffPool || exactScorePool) && (
        <section>
          <StatLabel>{t("statBonusPools")}</StatLabel>
          {goalDiffPool && <BonusPoolRow label={t("poolGoalDiff")} level={goalDiffPool} />}
          {exactScorePool && <BonusPoolRow label={t("poolExactScore")} level={exactScorePool} />}
        </section>
      )}
    </div>
  );
}
