"use client";

import { Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { ProfitDisplay } from "@/components/group-summary-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "@/i18n/navigation";

interface MiniLeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  profit: number;
}

export interface CircleCardItem {
  circleId: string;
  circleName: string;
  circleSlug: string;
  tournamentSlug: string;
  myProfit: number;
  myRank: number | null;
  miniLeaderboard: MiniLeaderboardEntry[];
}

const MINI_MEDALS = ["🥇", "🥈", "🥉"];

export function CircleSummaryCard({
  circle: c,
  currentUserId,
}: {
  circle: CircleCardItem;
  currentUserId: string;
}) {
  const t = useTranslations("circles");

  return (
    <Link
      href={`/tournaments/${c.tournamentSlug}/circles/${c.circleSlug}`}
      className="flex flex-col gap-[11px] rounded-lg border border-border bg-card p-[15px] text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-gold-line"
    >
      <div className="flex items-start gap-2.5">
        <span className="grid size-[34px] flex-none place-items-center rounded-[9px] border border-border bg-surface-2 text-muted-foreground">
          <Users className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-[15px] leading-tight">{c.circleName}</div>
        </div>
        {c.myRank != null && (
          <div className="flex-none text-right">
            <div className="font-extrabold font-mono text-[17px]">#{c.myRank}</div>
          </div>
        )}
      </div>

      {c.miniLeaderboard.length > 0 && (
        <div className="flex flex-col gap-1 rounded-[10px] bg-surface-2 p-2.5">
          {c.miniLeaderboard.map((entry, i) => {
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

      {/* Footer: profit + circle-type marker (mirrors the group card's footer) */}
      <div className="flex items-center justify-between gap-2">
        <ProfitDisplay profit={c.myProfit} />
        <span className="inline-flex items-center gap-[5px] font-semibold text-[11.5px] text-faint">
          <Users className="size-3.5" />
          {t("badge")}
        </span>
      </div>
    </Link>
  );
}
