"use client";

import type { ReactNode } from "react";
import { TokenIcon } from "@/components/token-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  const isWin = isFinished && bet.result1x2Correct === true;
  const isLoss = isFinished && bet.result1x2Correct === false;

  const rowBg = isCurrentUser
    ? isWin
      ? "bg-emerald-500/15"
      : isLoss
        ? "bg-destructive/15"
        : "bg-accent"
    : isWin
      ? "bg-emerald-500/5"
      : isLoss
        ? "bg-destructive/5"
        : "bg-muted/50";

  const textColor = isWin
    ? "text-emerald-600 dark:text-emerald-400"
    : isLoss
      ? "text-destructive"
      : "text-foreground";

  const netProfit = bet.payout != null ? bet.payout - bet.stake : null;
  const netColor =
    netProfit == null
      ? "text-muted-foreground"
      : netProfit > 0
        ? "text-emerald-600 dark:text-emerald-400"
        : netProfit < 0
          ? "text-destructive"
          : "text-muted-foreground";
  const netLabel =
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
      className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 ${rowBg} ${
        isCurrentUser ? "border-foreground/40 border-l-2" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        {rankLabel != null && (
          <span className="w-5 shrink-0 text-center font-mono font-semibold text-[11px] text-muted-foreground tabular-nums">
            {rankLabel}
          </span>
        )}
        <Avatar className="size-5 shrink-0">
          <AvatarImage src={bet.userAvatarUrl ?? undefined} alt={displayName} loading="lazy" />
          <AvatarFallback className="font-mono text-[9px]">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span
          className={`truncate text-xs ${
            isCurrentUser ? "font-semibold" : "text-muted-foreground"
          }`}
        >
          {displayName}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={`font-bold font-mono text-sm tabular-nums ${textColor}`}>
          {bet.predictedHome}-{bet.predictedAway}
        </span>
        {lockedOdds && (
          <span className="font-mono text-[11px] text-muted-foreground/70 tabular-nums">
            @{lockedOdds}
          </span>
        )}
        <span className="inline-flex items-center gap-0.5 font-mono text-muted-foreground text-xs">
          {bet.stake}
          <TokenIcon size={10} />
        </span>
        {netLabel != null && (
          <Badge variant="outline" className={`font-mono text-[10px] ${netColor}`}>
            {netLabel}
          </Badge>
        )}
      </div>
    </div>
  );
}
