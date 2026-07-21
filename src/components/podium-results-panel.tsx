"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { PodiumBadge } from "@/components/podium-form";
import { TokenIcon } from "@/components/token-icon";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/user-avatar";
import { pickTipsView } from "@/lib/match-stats";
import {
  computePodiumStats,
  type PodiumHit,
  type PodiumSlot,
  type RankedPodiumBet,
  rankPodiumBetsByPaid,
} from "@/lib/podium-stats";
import { cn } from "@/lib/utils";
import type { GroupPodiumData, PodiumMemberBet, PodiumTeamDisplay } from "@/queries/podium-results";

interface PodiumResultsPanelProps extends GroupPodiumData {
  currentUserId: string;
}

const SLOTS: PodiumSlot[] = ["gold", "silver", "bronze"];
const SLOT_EMOJI: Record<PodiumSlot, string> = { gold: "🥇", silver: "🥈", bronze: "🥉" };

/** A dobogó három foka a végeredményhez — a tipp-űrlap vizuális nyelvén. */
const RESULT_STEP: Record<PodiumSlot, { height: string; order: string; bar: string }> = {
  silver: { height: "h-[74px]", order: "order-1", bar: "bg-[#9aa6b8] text-white" },
  gold: { height: "h-[98px]", order: "order-2", bar: "bg-gold-2 text-gold-ink" },
  bronze: { height: "h-[58px]", order: "order-3", bar: "bg-[#c47a3e] text-white" },
};

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

/** A tényleges dobogó: ezüst–arany–bronz sorrendben, magasodó fokokkal. */
function ResultPodium({ actual }: { actual: NonNullable<GroupPodiumData["actual"]> }) {
  return (
    <div className="mx-auto flex w-full max-w-[340px] items-end justify-center gap-2.5">
      {SLOTS.map((slot) => {
        const step = RESULT_STEP[slot];
        const team = actual[slot];
        return (
          <div key={slot} className={cn("flex flex-1 flex-col items-center gap-2", step.order)}>
            <PodiumBadge team={team} size="sm" />
            <div className="w-full truncate text-center font-semibold text-[12px]">{team.name}</div>
            <div
              className={cn(
                "flex w-full items-start justify-center rounded-t-md pt-2 font-bold font-mono text-[22px] leading-none",
                step.height,
                step.bar,
              )}
            >
              {SLOT_EMOJI[slot]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Egy tippelt csapat a sorban, a találat típusával megjelölve. */
function HitBadge({
  team,
  hit,
  slot,
  label,
}: {
  team: PodiumTeamDisplay | undefined;
  hit: PodiumHit;
  slot: PodiumSlot;
  label: string;
}) {
  if (!team) return null;

  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-full border py-px pr-2 pl-px",
        hit === "exact" && "border-gold-line bg-gold-soft",
        hit === "mention" && "border-border bg-secondary",
        hit === "miss" && "border-transparent bg-secondary opacity-55",
      )}
      title={label}
    >
      <PodiumBadge team={team} size="xs" />
      <span className="font-mono text-[10px] leading-none">
        {SLOT_EMOJI[slot]}
        {hit === "exact" && <span className="ml-0.5 text-gold-text">✓</span>}
      </span>
    </span>
  );
}

function PodiumBetRow({
  bet,
  teamsById,
  isCurrentUser,
  youLabel,
  rankLabel,
  hitLabels,
}: {
  bet: RankedPodiumBet<PodiumMemberBet>;
  teamsById: Record<string, PodiumTeamDisplay>;
  isCurrentUser: boolean;
  youLabel: string;
  rankLabel: React.ReactNode;
  hitLabels: Record<PodiumHit, string>;
}) {
  const displayName = isCurrentUser ? youLabel : (bet.userDisplayName ?? bet.userName);
  const picks: Record<PodiumSlot, string> = {
    gold: bet.goldTeamId,
    silver: bet.silverTeamId,
    bronze: bet.bronzeTeamId,
  };

  return (
    <div
      className={cn(
        "grid grid-cols-[26px_26px_1fr_auto] items-center gap-2.5 rounded-[10px] border px-2.5 py-[7px]",
        isCurrentUser ? "border-gold-line bg-gold-soft" : "border-transparent bg-secondary",
      )}
    >
      <span className="text-center font-bold font-mono text-[13px] text-faint tabular-nums">
        {rankLabel}
      </span>
      <UserAvatar
        name={displayName}
        googleAvatarUrl={bet.userAvatarUrl}
        gravatarHash={bet.gravatarHash}
        className="size-[26px] shrink-0"
        fallbackClassName="text-[12px]"
        alt={displayName}
        loading="lazy"
      />
      <div className="min-w-0">
        <div className="truncate font-semibold text-[13.5px]">{displayName}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {SLOTS.map((slot) => (
            <HitBadge
              key={slot}
              team={teamsById[picks[slot]]}
              hit={bet.hits[slot]}
              slot={slot}
              label={hitLabels[bet.hits[slot]]}
            />
          ))}
        </div>
      </div>
      <span
        className={cn(
          "flex items-center gap-[3px] font-bold font-mono text-[13.5px] tabular-nums",
          bet.points > 0 ? "text-gold-text" : "text-faint",
        )}
      >
        {bet.points > 0 ? `+${bet.points}` : "0"}
        <TokenIcon size={10} />
      </span>
    </div>
  );
}

/** Csapatonkénti tipp-megoszlás egy helyre, arányos sávokkal. */
function PickBars({
  picks,
  teamsById,
  total,
  actualTeamId,
}: {
  picks: { teamId: string; count: number }[];
  teamsById: Record<string, PodiumTeamDisplay>;
  total: number;
  actualTeamId: string | null;
}) {
  const top = picks.slice(0, 5);

  return (
    <div className="flex flex-col gap-1">
      {top.map((pick) => {
        const team = teamsById[pick.teamId];
        const pct = total > 0 ? Math.round((pick.count / total) * 100) : 0;
        const isActual = pick.teamId === actualTeamId;
        return (
          <div key={pick.teamId} className="flex items-center gap-2">
            <span className="w-[92px] shrink-0 truncate text-[12px]" title={team?.name}>
              {isActual && <span className="mr-1 text-gold-text">✓</span>}
              {team?.name ?? "—"}
            </span>
            <span className="h-[7px] flex-1 overflow-hidden rounded-full bg-secondary">
              <span
                className={cn("block h-full rounded-full", isActual ? "bg-gold-2" : "bg-faint/50")}
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="w-[26px] shrink-0 text-right font-mono text-[11px] text-muted-foreground tabular-nums">
              {pick.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * A dobogó-fül lezárt torna utáni nézete: a végeredmény, majd — a meccskártya
 * mintájára — egy Tippek és egy Statisztika al-fül. Csak akkor renderelődik, ha
 * a torna dobogója már be van írva (`actual != null`).
 */
export function PodiumResultsPanel({
  actual,
  bets,
  teamsById,
  paidByUser,
  currentUserId,
}: PodiumResultsPanelProps) {
  const t = useTranslations("podium");
  const tMatches = useTranslations("matches");
  const [expanded, setExpanded] = useState(false);

  const actualIds = actual
    ? { gold: actual.gold.id, silver: actual.silver.id, bronze: actual.bronze.id }
    : null;

  const ranked = useMemo(
    () => (actualIds ? rankPodiumBetsByPaid(bets, actualIds, paidByUser) : []),
    [bets, actualIds, paidByUser],
  );
  const stats = useMemo(() => computePodiumStats(bets, actualIds), [bets, actualIds]);
  const view = useMemo(() => pickTipsView(ranked, currentUserId), [ranked, currentUserId]);

  if (!actual || !actualIds) return null;

  const hitLabels: Record<PodiumHit, string> = {
    exact: t("hitExact"),
    mention: t("hitMention"),
    miss: t("hitMiss"),
  };

  const totalPaid = ranked.reduce((sum, bet) => sum + bet.points, 0);
  const medalFor = (rank: number) => (rank <= 3 ? SLOT_EMOJI[SLOTS[rank - 1]] : rank);

  const renderRow = (bet: RankedPodiumBet<PodiumMemberBet>) => (
    <PodiumBetRow
      key={bet.betId}
      bet={bet}
      teamsById={teamsById}
      isCurrentUser={bet.userId === currentUserId}
      youLabel={tMatches("youLabel")}
      rankLabel={medalFor(bet.rank)}
      hitLabels={hitLabels}
    />
  );

  const showAllButton = ranked.length > view.podium.length + view.neighbors.length && (
    <button
      type="button"
      onClick={() => setExpanded(true)}
      className="mt-1 w-full rounded-sm border border-dashed py-1.5 font-mono text-gold text-xs"
    >
      {tMatches("showAll", { count: ranked.length })}
    </button>
  );

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 px-4 py-5">
        <div className="flex flex-col gap-2">
          <StatLabel>{t("finalResult")}</StatLabel>
          <ResultPodium actual={actual} />
        </div>

        <Tabs defaultValue="tips">
          <TabsList className="w-full">
            <TabsTrigger value="tips">{tMatches("tipsTab")}</TabsTrigger>
            <TabsTrigger value="stats">{tMatches("statsTab")}</TabsTrigger>
          </TabsList>

          <TabsContent value="tips" className="mt-3 flex flex-col gap-1">
            {ranked.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground text-sm">{t("noPodiumBets")}</p>
            ) : expanded ? (
              <>
                {ranked.map(renderRow)}
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="mt-1 w-full rounded-sm border border-dashed py-1.5 font-mono text-gold text-xs"
                >
                  {tMatches("collapseList")}
                </button>
              </>
            ) : (
              <>
                {view.podium.map(renderRow)}
                {view.hiddenBetween > 0 && (
                  <div className="py-1 text-center font-mono text-[11px] text-faint">
                    {tMatches("hiddenBetween", { count: view.hiddenBetween })}
                  </div>
                )}
                {view.neighbors.map(renderRow)}
                {showAllButton}
              </>
            )}
          </TabsContent>

          <TabsContent value="stats" className="mt-3 flex flex-col gap-4">
            <div>
              <StatLabel>{t("statTippers")}</StatLabel>
              <KeyValue label={t("statBetCount")}>{stats.betCount}</KeyValue>
              <KeyValue label={t("statGoldCorrect")}>{stats.goldCorrectCount ?? 0}</KeyValue>
              <KeyValue label={t("statPerfect")}>{stats.perfectCount ?? 0}</KeyValue>
              <KeyValue label={t("statTotalPaid")}>
                {totalPaid}
                <TokenIcon size={10} />
              </KeyValue>
            </div>

            {SLOTS.map((slot) => (
              <div key={slot}>
                <StatLabel>
                  {SLOT_EMOJI[slot]} {t(`statPicks.${slot}`)}
                </StatLabel>
                <PickBars
                  picks={
                    slot === "gold"
                      ? stats.goldPicks
                      : slot === "silver"
                        ? stats.silverPicks
                        : stats.bronzePicks
                  }
                  teamsById={teamsById}
                  total={stats.betCount}
                  actualTeamId={actualIds[slot]}
                />
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
