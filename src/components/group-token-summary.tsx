"use client";

import { ChevronRight, CircleAlert, CircleCheck, TrendingDown, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

interface MiniLeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  profit: number;
}

interface GroupCardItem {
  groupId: string;
  groupName: string;
  groupSlug: string;
  myProfit: number;
  myRank: number | null;
  miniLeaderboard: MiniLeaderboardEntry[];
  unbettedCount: number;
}

interface GroupTokenSummaryProps {
  groups: GroupCardItem[];
  currentUserId: string;
}

function ProfitDisplay({ profit }: { profit: number }) {
  const formatted = profit > 0 ? `+${profit}` : `${profit}`;
  const colorClass =
    profit > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : profit < 0
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";

  return <span className={`font-mono text-sm font-bold ${colorClass}`}>{formatted}</span>;
}

export function GroupTokenSummary({ groups, currentUserId }: GroupTokenSummaryProps) {
  const t = useTranslations("tournaments");

  if (groups.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {groups.map((g) => {
        const hasWarning = g.unbettedCount > 0;

        return (
          <Link
            key={g.groupId}
            href={`/groups/${g.groupSlug}`}
            className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/50"
          >
            {/* Header: group name + arrow */}
            <div className="flex items-center justify-between">
              <span className="font-medium">{g.groupName}</span>
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>

            {/* Mini leaderboard */}
            {g.miniLeaderboard.length > 0 && (
              <div className="flex flex-col gap-1">
                {g.miniLeaderboard.map((entry) => {
                  const isMe = entry.userId === currentUserId;
                  return (
                    <div
                      key={entry.userId}
                      className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                        isMe ? "bg-amber-500/10 ring-1 ring-inset ring-amber-500/20" : ""
                      }`}
                    >
                      <span className="w-8 font-mono text-xs text-muted-foreground">
                        #{entry.rank}
                      </span>
                      <span className={`flex-1 truncate ${isMe ? "font-medium" : ""}`}>
                        {entry.userName}
                      </span>
                      <ProfitDisplay profit={entry.profit} />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer: profit + unbetted info */}
            <div className="flex items-center gap-3 border-t border-border pt-2 text-xs text-muted-foreground">
              <span
                className={`flex items-center gap-1 font-mono font-medium ${
                  g.myProfit > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : g.myProfit < 0
                      ? "text-red-600 dark:text-red-400"
                      : ""
                }`}
              >
                {g.myProfit > 0 ? (
                  <TrendingUp className="size-3.5" />
                ) : g.myProfit < 0 ? (
                  <TrendingDown className="size-3.5" />
                ) : null}
                {t("profit")}: {g.myProfit > 0 ? `+${g.myProfit}` : g.myProfit}
              </span>

              {hasWarning ? (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <CircleAlert className="size-3.5" />
                  {t("unbettedMatches", { count: g.unbettedCount })}
                </span>
              ) : g.unbettedCount === 0 ? (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CircleCheck className="size-3.5" />
                  {t("allBetsPlaced")}
                </span>
              ) : null}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
