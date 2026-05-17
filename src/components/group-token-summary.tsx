"use client";

import {
  ChevronRight,
  CircleAlert,
  CircleCheck,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { GroupCard } from "@/components/group-card";
import { PublicGroupDialog } from "@/components/public-group-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { PublicGroupSuggestion } from "@/queries/groups";

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

interface GroupCardItem {
  groupId: string;
  groupName: string;
  groupSlug: string;
  tournamentSlug: string;
  myProfit: number;
  myRank: number | null;
  miniLeaderboard: MiniLeaderboardEntry[];
  next3Days: Next3DaysProgress;
}

interface GroupTokenSummaryProps {
  groups: GroupCardItem[];
  currentUserId: string;
  topPublicGroups?: PublicGroupSuggestion[];
  hasOfficialGroup?: boolean;
}

function ProfitDisplay({ profit }: { profit: number }) {
  const formatted = profit > 0 ? `+${profit}` : `${profit}`;
  const colorClass =
    profit > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : profit < 0
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";

  return <span className={`font-bold font-mono text-sm ${colorClass}`}>{formatted}</span>;
}

export function GroupTokenSummary({
  groups,
  currentUserId,
  topPublicGroups = [],
  hasOfficialGroup = false,
}: GroupTokenSummaryProps) {
  const t = useTranslations("tournaments");
  const [selectedGroup, setSelectedGroup] = useState<PublicGroupSuggestion | null>(null);

  if (groups.length === 0) {
    // Suppressed for now per request — show only the public-group suggestions block
    // when there are recommendations. The "Csoport létrehozása" prompt below is
    // commented out and can be restored when we want to nudge users toward creating
    // their own group again.
    if (!topPublicGroups || topPublicGroups.length === 0) {
      /*
      const emptyHeadline = hasOfficialGroup
        ? t("createOwnGroupHint")
        : t("noPublicGroup");
      return (
        <div className="rounded-lg border border-border border-dashed bg-muted/30 p-4">
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">{emptyHeadline}</p>
            <Button variant="outline" size="sm" asChild className="gap-2 self-start">
              <Link href="/groups/new">{t("createGroup")}</Link>
            </Button>
          </div>
        </div>
      );
      */
      return null;
    }

    const emptyHeadline = hasOfficialGroup ? t("joinAnotherGroup") : t("noGroupYet");

    return (
      <>
        <div className="rounded-lg border border-border border-dashed bg-muted/30 p-4">
          <div className="flex flex-col gap-4">
            <p className="text-muted-foreground text-sm">{emptyHeadline}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {topPublicGroups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  memberCount={group.memberCount}
                  variant="public"
                  onClick={() => setSelectedGroup(group)}
                />
              ))}
            </div>
            <Button variant="outline" size="sm" asChild className="gap-2 self-start">
              <Link href="/groups">
                <Users className="size-4" />
                {t("browseGroups")}
              </Link>
            </Button>
          </div>
        </div>

        {selectedGroup && (
          <PublicGroupDialog
            group={selectedGroup}
            memberCount={selectedGroup.memberCount}
            open={!!selectedGroup}
            onOpenChange={(open) => {
              if (!open) setSelectedGroup(null);
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {groups.map((g) => {
        const hasMatches = g.next3Days.total > 0;
        const allPlaced = hasMatches && g.next3Days.withBet === g.next3Days.total;

        return (
          <Link
            key={g.groupId}
            href={`/tournaments/${g.tournamentSlug}/groups/${g.groupSlug}`}
            className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-all hover:bg-accent hover:ring-1 hover:ring-foreground/15"
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
                        isMe ? "bg-amber-500/10 ring-1 ring-amber-500/20 ring-inset" : ""
                      }`}
                    >
                      <span className="w-8 font-mono text-muted-foreground text-xs">
                        #{entry.rank}
                      </span>
                      <Avatar className="size-5">
                        <AvatarImage src={entry.userAvatarUrl ?? undefined} />
                        <AvatarFallback className="text-[10px]">
                          {entry.userName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
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
            <div className="flex items-center gap-3 border-border border-t pt-2 text-muted-foreground text-xs">
              <span
                className={`flex items-center gap-1 font-medium font-mono ${
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

              {!hasMatches ? (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <CircleCheck className="size-3.5" />
                  {t("next3Days.none")}
                </span>
              ) : allPlaced ? (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CircleCheck className="size-3.5" />
                  {t("next3Days.progress", {
                    total: g.next3Days.total,
                    withBet: g.next3Days.withBet,
                  })}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
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
      })}
    </div>
  );
}
