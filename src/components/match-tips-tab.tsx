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
    <div className="px-1 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
      {children}
    </div>
  );
}

export function MatchTipsTab({ bets, currentUserId, isFinished, youLabel }: MatchTipsTabProps) {
  const t = useTranslations("matches");
  const [expanded, setExpanded] = useState(false);

  const ranked = useMemo(() => rankBets(bets, isFinished ? "profit" : "stake"), [bets, isFinished]);

  if (bets.length === 0) {
    return <p className="py-2 text-center text-muted-foreground text-xs">{t("noBetsYet")}</p>;
  }

  // Expanded: the full ranking in a scrollable box (data is already loaded).
  if (expanded) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex max-h-80 flex-col gap-1 overflow-y-auto pr-1">
          {ranked.map((bet) => (
            <BetRow
              key={bet.betId}
              bet={bet}
              isCurrentUser={bet.userId === currentUserId}
              isFinished={isFinished}
              youLabel={youLabel}
              rankLabel={isFinished ? medalFor(bet.rank) : undefined}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="w-full rounded-md border border-dashed px-2.5 py-1.5 text-center text-muted-foreground text-xs transition-colors hover:bg-muted/50"
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
      className="w-full rounded-md border border-dashed px-2.5 py-1.5 text-center text-muted-foreground text-xs transition-colors hover:bg-muted/50"
    >
      {t("showAll", { count: ranked.length })}
    </button>
  );

  // Live match: no ranking yet — current user first, then by stake, capped.
  if (!isFinished) {
    const sorted = sortLiveBets(bets, currentUserId);
    const visible = sorted.slice(0, LIVE_COLLAPSED_ROWS);
    return (
      <div className="flex flex-col gap-1">
        {visible.map((bet) => (
          <BetRow
            key={bet.betId}
            bet={bet}
            isCurrentUser={bet.userId === currentUserId}
            isFinished={false}
            youLabel={youLabel}
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
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-col gap-1">
        {hasNeighbors && <SectionLabel>{t("podium")}</SectionLabel>}
        {view.podium.map((bet) => (
          <BetRow
            key={bet.betId}
            bet={bet}
            isCurrentUser={bet.userId === currentUserId}
            isFinished
            youLabel={youLabel}
            rankLabel={medalFor(bet.rank)}
          />
        ))}
      </div>

      {hasNeighbors && (
        <div className="flex flex-col gap-1">
          {view.hiddenBetween > 0 && (
            <div className="py-0.5 text-center text-[10px] text-muted-foreground/60">
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
              rankLabel={medalFor(bet.rank)}
            />
          ))}
        </div>
      )}

      {ranked.length > view.podium.length + view.neighbors.length && showAllButton}
    </div>
  );
}
