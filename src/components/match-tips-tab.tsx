"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { BetRow } from "@/components/bet-row";
import { pickTipsView, rankBets, sortLiveBets } from "@/lib/match-stats";
import type { GroupMemberBet } from "@/queries/bets";

interface MatchTipsTabProps {
  bets: GroupMemberBet[];
  currentUserId: string;
  isFinished: boolean;
  youLabel: string;
  oddsBoost: number;
}

/** Number of rows shown before "show all" on a live match (no ranking yet). */
const LIVE_COLLAPSED_ROWS = 5;

function medalFor(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return String(rank);
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-0.5 mb-1 px-1 font-bold text-[10px] text-faint uppercase tracking-[0.12em]">
      {children}
    </div>
  );
}

export function MatchTipsTab({
  bets,
  currentUserId,
  isFinished,
  youLabel,
  oddsBoost,
}: MatchTipsTabProps) {
  const t = useTranslations("matches");
  const [expanded, setExpanded] = useState(false);

  const ranked = useMemo(() => rankBets(bets, isFinished ? "profit" : "stake"), [bets, isFinished]);

  if (bets.length === 0) {
    return <p className="py-2 text-center text-muted-foreground text-xs">{t("noBetsYet")}</p>;
  }

  // Expanded: the full ranking. No inner scroll box — the list flows into the
  // dialog's own max-h/overflow, same as the collapsed view, so expanding grows
  // the modal instead of shrinking it to a fixed-height box.
  if (expanded) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-col gap-[5px]">
          {ranked.map((bet) => (
            <BetRow
              key={bet.betId}
              bet={bet}
              isCurrentUser={bet.userId === currentUserId}
              isFinished={isFinished}
              youLabel={youLabel}
              oddsBoost={oddsBoost}
              rankLabel={isFinished ? medalFor(bet.rank) : undefined}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="w-full rounded-sm border border-border border-dashed px-2.5 py-1.5 text-center font-medium font-mono text-gold text-xs transition-colors hover:bg-secondary"
        >
          {t("collapseList")}
        </button>
      </div>
    );
  }

  const showAllButton = (
    <button
      type="button"
      onClick={() => setExpanded(true)}
      className="w-full rounded-sm border border-border border-dashed px-2.5 py-1.5 text-center font-medium font-mono text-gold text-xs transition-colors hover:bg-secondary"
    >
      {t("showAll", { count: ranked.length })}
    </button>
  );

  // Live match: no ranking yet — current user first, then by stake, capped.
  if (!isFinished) {
    const sorted = sortLiveBets(bets, currentUserId);
    const visible = sorted.slice(0, LIVE_COLLAPSED_ROWS);
    return (
      <div className="flex flex-col gap-[5px]">
        {visible.map((bet) => (
          <BetRow
            key={bet.betId}
            bet={bet}
            isCurrentUser={bet.userId === currentUserId}
            isFinished={false}
            youLabel={youLabel}
            oddsBoost={oddsBoost}
          />
        ))}
        {sorted.length > visible.length && showAllButton}
      </div>
    );
  }

  // Finished match: podium + a window around the current user.
  const view = pickTipsView(ranked, currentUserId);
  const hasNeighbors = view.neighbors.length > 0;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-[5px]">
        {hasNeighbors && <SectionLabel>{t("podium")}</SectionLabel>}
        {view.podium.map((bet) => (
          <BetRow
            key={bet.betId}
            bet={bet}
            isCurrentUser={bet.userId === currentUserId}
            isFinished
            youLabel={youLabel}
            oddsBoost={oddsBoost}
            rankLabel={medalFor(bet.rank)}
          />
        ))}
      </div>

      {hasNeighbors && (
        <div className="flex flex-col gap-[5px]">
          {view.hiddenBetween > 0 && (
            <div className="py-1 text-center text-[10px] text-faint">
              {t("hiddenBetween", { count: view.hiddenBetween })}
            </div>
          )}
          <SectionLabel>{t("aroundYou")}</SectionLabel>
          {view.neighbors.map((bet) => (
            <BetRow
              key={bet.betId}
              bet={bet}
              isCurrentUser={bet.userId === currentUserId}
              isFinished
              youLabel={youLabel}
              oddsBoost={oddsBoost}
              rankLabel={medalFor(bet.rank)}
            />
          ))}
        </div>
      )}

      {ranked.length > view.podium.length + view.neighbors.length && showAllButton}
    </div>
  );
}
