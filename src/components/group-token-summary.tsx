"use client";

import { CircleAlert, CircleCheck, Users } from "lucide-react";
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
  const colorClass = profit > 0 ? "text-win" : profit < 0 ? "text-loss" : "text-muted-foreground";

  return <span className={`font-bold font-mono text-sm ${colorClass}`}>{formatted}</span>;
}

const MINI_MEDALS = ["🥇", "🥈", "🥉"];

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
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
      {groups.map((g) => {
        const hasMatches = g.next3Days.total > 0;
        const allPlaced = hasMatches && g.next3Days.withBet === g.next3Days.total;

        return (
          <Link
            key={g.groupId}
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
      })}
    </div>
  );
}
