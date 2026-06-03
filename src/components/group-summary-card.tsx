"use client";

import { CircleAlert, CircleCheck, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "@/i18n/navigation";

interface MiniLeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  profit: number;
}

interface Next3DaysProgress {
  total: number;
  withBet: number;
}

export interface GroupCardItem {
  groupId: string;
  groupName: string;
  groupSlug: string;
  tournamentSlug: string;
  myProfit: number;
  myRank: number | null;
  miniLeaderboard: MiniLeaderboardEntry[];
  next3Days: Next3DaysProgress;
}

const MINI_MEDALS = ["🥇", "🥈", "🥉"];

export function ProfitDisplay({ profit }: { profit: number }) {
  const formatted = profit > 0 ? `+${profit}` : `${profit}`;
  const colorClass = profit > 0 ? "text-win" : profit < 0 ? "text-loss" : "text-muted-foreground";

  return <span className={`font-bold font-mono text-sm ${colorClass}`}>{formatted}</span>;
}

export function GroupSummaryCard({
  group: g,
  currentUserId,
}: {
  group: GroupCardItem;
  currentUserId: string;
}) {
  const t = useTranslations("tournaments");
  const hasMatches = g.next3Days.total > 0;
  const allPlaced = hasMatches && g.next3Days.withBet === g.next3Days.total;

  return (
    <Link
      href={`/tournaments/${g.tournamentSlug}/groups/${g.groupSlug}`}
      className="flex flex-col gap-[11px] rounded-lg border border-border bg-card p-[15px] text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-gold-line"
    >
      {/* Top: icon + name + rank */}
      <div className="flex items-start gap-2.5">
        <span className="grid size-[34px] flex-none place-items-center rounded-[9px] border border-border bg-surface-2 text-muted-foreground">
          <Users className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-[15px] leading-tight">{g.groupName}</div>
        </div>
        {g.myRank != null && (
          <div className="flex-none text-right">
            <div className="font-extrabold font-mono text-[17px]">#{g.myRank}</div>
          </div>
        )}
      </div>

      {/* Mini leaderboard */}
      {g.miniLeaderboard.length > 0 && (
        <div className="flex flex-col gap-1 rounded-[10px] bg-surface-2 p-2.5">
          {g.miniLeaderboard.map((entry, i) => {
            const isMe = entry.userId === currentUserId;
            return (
              <div key={entry.userId} className="flex items-center gap-2 text-xs">
                <span className="w-4 font-mono text-faint">
                  {MINI_MEDALS[i] ?? `#${entry.rank}`}
                </span>
                <Avatar className="size-[18px]">
                  <AvatarImage src={entry.userAvatarUrl ?? undefined} />
                  <AvatarFallback className="text-[9px]">
                    {entry.userName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <span className={`flex-1 truncate ${isMe ? "font-bold" : ""}`}>
                  {entry.userName}
                </span>
                <span
                  className={`font-bold font-mono ${entry.profit >= 0 ? "text-win" : "text-loss"}`}
                >
                  {entry.profit > 0 ? `+${entry.profit}` : entry.profit}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer: profit + unbetted info */}
      <div className="flex items-center justify-between gap-2">
        <ProfitDisplay profit={g.myProfit} />

        {!hasMatches ? (
          <span className="inline-flex items-center gap-[5px] font-semibold text-[11.5px] text-faint">
            <CircleCheck className="size-3.5" />
            {t("next3Days.none")}
          </span>
        ) : allPlaced ? (
          <span className="inline-flex items-center gap-[5px] text-[11.5px] text-faint">
            <CircleCheck className="size-3.5" />
            {t("next3Days.progress", {
              total: g.next3Days.total,
              withBet: g.next3Days.withBet,
            })}
          </span>
        ) : (
          <span className="inline-flex items-center gap-[5px] font-semibold text-[11.5px] text-gold">
            <CircleAlert className="size-3.5" />
            {t("next3Days.progress", {
              total: g.next3Days.total,
              withBet: g.next3Days.withBet,
            })}
          </span>
        )}
      </div>
    </Link>
  );
}
