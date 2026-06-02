"use client";

import { ChevronDown, ChevronUp, CircleAlert, CircleCheck, Crown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { GroupRulesDialog } from "@/components/group-rules-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "@/i18n/navigation";
import type { GroupRules } from "@/lib/group-rules";

const STORAGE_KEY = "tipper:officialRibbon:open";

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

interface OfficialGroupRibbonProps {
  groupName: string;
  groupSlug: string;
  tournamentSlug: string;
  rules: GroupRules;
  myProfit: number;
  myRank: number | null;
  miniLeaderboard: MiniLeaderboardEntry[];
  currentUserId: string;
  next3Days: Next3DaysProgress;
}

export function OfficialGroupRibbon({
  groupName,
  groupSlug,
  tournamentSlug,
  rules,
  myProfit,
  myRank,
  miniLeaderboard,
  currentUserId,
  next3Days,
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
    <div className="overflow-hidden rounded-lg border border-gold-line bg-card shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_12px_28px_-22px_rgba(0,0,0,0.9)]">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={
          open ? tTournaments("officialRibbon.collapse") : tTournaments("officialRibbon.expand")
        }
        className="flex w-full items-center gap-3 bg-linear-to-r from-gold-soft to-transparent px-4 py-3 text-left"
      >
        <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-linear-to-br from-gold to-gold-2 text-gold-ink">
          <Crown className="size-4" />
        </span>
        <span className="font-mono text-[13.5px]">
          <span className="font-bold">{rankDisplay}</span>
          <span className="text-muted-foreground"> · </span>
          <span className="font-bold text-gold">{myProfit}</span>
        </span>
        {next3Days.total === 0 ? (
          <span className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
            <CircleCheck className="size-3.5" />
            {tTournaments("next3Days.none")}
          </span>
        ) : next3Days.withBet === next3Days.total ? (
          <span className="flex items-center gap-1.5 text-[12.5px] text-win">
            <CircleCheck className="size-3.5" />
            {tTournaments("next3Days.progress", {
              total: next3Days.total,
              withBet: next3Days.withBet,
            })}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[12.5px] text-gold">
            <CircleAlert className="size-3.5" />
            {tTournaments("next3Days.progress", {
              total: next3Days.total,
              withBet: next3Days.withBet,
            })}
          </span>
        )}
        <span className="ml-auto flex items-center gap-2 text-muted-foreground">
          <Link
            href={`/tournaments/${tournamentSlug}/groups/${groupSlug}`}
            onClick={(e) => e.stopPropagation()}
            className="hidden font-medium font-mono text-[12.5px] text-gold hover:underline sm:inline"
          >
            {t("viewDetails")} →
          </Link>
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-gold-line border-t px-4 py-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-sm">{groupName}</span>
            <GroupRulesDialog groupName={groupName} rules={rules} />
          </div>
          {miniLeaderboard.length > 0 && (
            <Link
              href={`/tournaments/${tournamentSlug}/groups/${groupSlug}`}
              aria-label={t("viewDetails")}
              className="flex flex-col gap-1 rounded-sm outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-gold"
            >
              {miniLeaderboard.map((row) => {
                const isCurrentUser = row.userId === currentUserId;
                return (
                  <div
                    key={row.userId}
                    className={`flex items-center gap-2.5 rounded-[10px] px-2.5 py-[7px] text-[14px] ${
                      isCurrentUser ? "bg-gold-soft" : ""
                    }`}
                  >
                    <span className="w-[30px] font-bold font-mono text-muted-foreground">
                      #{row.rank}
                    </span>
                    <Avatar className="size-[26px]">
                      <AvatarImage src={row.userAvatarUrl ?? undefined} />
                      <AvatarFallback className="text-[11px]">
                        {row.userName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate">{row.userName}</span>
                    <span className="font-bold font-mono text-gold">{row.profit}</span>
                  </div>
                );
              })}
              <span className="mt-1.5 flex items-center justify-center gap-1.5 border-border border-t pt-[9px] font-mono font-semibold text-[12.5px] text-gold">
                {t("viewDetails")} →
              </span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
