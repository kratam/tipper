"use client";

import { ChevronDown, ChevronUp, CircleAlert, CircleCheck, Crown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "@/i18n/navigation";

const STORAGE_KEY = "tipper:officialRibbon:open";

interface MiniLeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  profit: number;
}

interface OfficialGroupRibbonProps {
  groupName: string;
  groupSlug: string;
  tournamentSlug: string;
  oddsBoost: number;
  myProfit: number;
  myRank: number | null;
  miniLeaderboard: MiniLeaderboardEntry[];
  currentUserId: string;
  unbettedCount: number;
}

export function OfficialGroupRibbon({
  groupName,
  groupSlug,
  tournamentSlug,
  oddsBoost,
  myProfit,
  myRank,
  miniLeaderboard,
  currentUserId,
  unbettedCount,
}: OfficialGroupRibbonProps) {
  const t = useTranslations("groups");
  const tTournaments = useTranslations("tournaments");

  const [open, setOpen] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setOpen(true);
  }, []);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore quota / disabled storage
      }
      return next;
    });
  }

  const rankDisplay = myRank ? `#${myRank}` : "—";

  return (
    <div className="overflow-hidden rounded-lg border-2 border-amber-500/40 bg-card">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={
          open ? tTournaments("officialRibbon.collapse") : tTournaments("officialRibbon.expand")
        }
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-amber-500/5"
      >
        <Crown className="size-5 shrink-0 text-amber-500" />
        <span className="font-mono text-sm">
          <span className="font-bold">{rankDisplay}</span>
          <span className="text-muted-foreground"> · </span>
          <span className="font-bold text-amber-500">{myProfit}</span>
        </span>
        {unbettedCount > 0 ? (
          <span className="flex items-center gap-1.5 text-amber-600 text-xs dark:text-amber-400">
            <CircleAlert className="size-3.5" />
            {tTournaments("unbettedMatches", { count: unbettedCount })}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-emerald-600 text-xs dark:text-emerald-400">
            <CircleCheck className="size-3.5" />
            {tTournaments("allBetsPlaced")}
          </span>
        )}
        <span className="ml-auto flex items-center gap-2 text-muted-foreground">
          <Link
            href={`/tournaments/${tournamentSlug}/groups/${groupSlug}`}
            onClick={(e) => e.stopPropagation()}
            className="hidden font-medium text-amber-600 text-sm hover:text-amber-700 hover:underline sm:inline dark:text-amber-400 dark:hover:text-amber-300"
          >
            {t("viewDetails")} →
          </Link>
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-amber-500/20 border-t bg-amber-500/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-bold">{groupName}</span>
            <span className="text-muted-foreground">
              · {t("oddsBoost")}: <span className="font-mono text-amber-500">×{oddsBoost}</span>
            </span>
          </div>
          {miniLeaderboard.length > 0 && (
            <div className="flex flex-col gap-1">
              {miniLeaderboard.map((row) => {
                const isCurrentUser = row.userId === currentUserId;
                return (
                  <div
                    key={row.userId}
                    className={`flex items-center gap-2 px-2 py-1 text-xs ${
                      isCurrentUser ? "rounded bg-amber-500/10" : ""
                    }`}
                  >
                    <span className="w-6 font-mono">#{row.rank}</span>
                    <Avatar className="size-5">
                      <AvatarImage src={row.userAvatarUrl ?? undefined} />
                      <AvatarFallback className="text-[10px]">
                        {row.userName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate">{row.userName}</span>
                    <span className="font-mono text-amber-500">{row.profit}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
