"use client";

import type { ReactNode } from "react";
import { TokenIcon } from "@/components/token-icon";
import { UserAvatar } from "@/components/user-avatar";
import { classify1x2 } from "@/lib/match-stats";
import { formatEffectiveOdds } from "@/lib/odds-display";
import { OUTCOME_GRADIENT } from "@/lib/outcome-colors";
import type { GroupMemberBet } from "@/queries/bets";

interface BetRowProps {
  bet: GroupMemberBet;
  isCurrentUser: boolean;
  isFinished: boolean;
  youLabel: string;
  /** Group odds boost — used to show the effective locked odds (`oddsAtBet × boost`). */
  oddsBoost: number;
  /** Optional rank cell shown on the left (medal emoji or position number). */
  rankLabel?: ReactNode;
}

export function BetRow({
  bet,
  isCurrentUser,
  isFinished,
  youLabel,
  oddsBoost,
  rankLabel,
}: BetRowProps) {
  const lockedOdds = formatEffectiveOdds(bet.oddsAtBet, oddsBoost);

  const netProfit = bet.payout != null ? bet.payout - bet.stake : null;
  const payoutColor =
    netProfit == null
      ? "text-foreground"
      : netProfit > 0
        ? "text-win"
        : netProfit < 0
          ? "text-loss"
          : "text-foreground";
  const payoutLabel =
    netProfit == null
      ? null
      : netProfit > 0
        ? `+${netProfit}`
        : netProfit < 0
          ? `${netProfit}`
          : "±0";

  const displayName = isCurrentUser ? youLabel : (bet.userDisplayName ?? bet.userName);
  const outcome = classify1x2(bet.predictedHome, bet.predictedAway);

  return (
    <div
      className={`grid grid-cols-[26px_26px_1fr_auto] items-center gap-2.5 rounded-[10px] border px-2.5 py-[7px] ${
        isCurrentUser ? "border-gold-line bg-gold-soft" : "border-transparent bg-secondary"
      }`}
    >
      {rankLabel != null ? (
        <span className="text-center font-bold font-mono text-[13px] text-faint tabular-nums">
          {rankLabel}
        </span>
      ) : (
        <span className="text-center text-faint">·</span>
      )}
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
        <div className="mt-px flex items-center gap-[7px] font-mono text-[11px] text-muted-foreground">
          <span
            className="rounded-full px-1.5 py-px font-bold text-[10.5px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(0,0,0,0.15)] [text-shadow:0_1px_1.5px_rgba(0,0,0,0.35)]"
            style={{ background: OUTCOME_GRADIENT[outcome] }}
          >
            {bet.predictedHome}–{bet.predictedAway}
          </span>
          {lockedOdds && <span className="tabular-nums">@{lockedOdds}</span>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-px">
        {isFinished && payoutLabel != null ? (
          <span className={`font-bold font-mono text-[13.5px] tabular-nums ${payoutColor}`}>
            {payoutLabel}
          </span>
        ) : (
          <span className="font-bold font-mono text-[13.5px] tabular-nums">{bet.stake}</span>
        )}
        <span className="flex items-center gap-[3px] font-mono text-[10.5px] text-faint">
          {bet.stake}
          <TokenIcon size={10} />
        </span>
      </div>
    </div>
  );
}
