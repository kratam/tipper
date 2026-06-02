"use client";

import type { ReactNode } from "react";
import { TokenIcon } from "@/components/token-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatEffectiveOdds } from "@/lib/odds-display";
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
      <Avatar className="size-[26px] shrink-0">
        <AvatarImage src={bet.userAvatarUrl ?? undefined} alt={displayName} loading="lazy" />
        <AvatarFallback className="font-mono text-[9px]">
          {displayName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="truncate font-semibold text-[13.5px]">{displayName}</div>
        <div className="mt-px flex items-center gap-[7px] font-mono text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">
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
