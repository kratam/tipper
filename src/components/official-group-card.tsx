"use client";

import { Crown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

interface MiniLeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  profit: number;
}

interface OfficialGroupCardProps {
  groupName: string;
  groupSlug: string;
  tournamentSlug: string;
  oddsBoost: number;
  myProfit: number;
  myRank: number | null;
  miniLeaderboard: MiniLeaderboardEntry[];
  currentUserId: string;
}

export function OfficialGroupCard({
  groupName,
  groupSlug,
  tournamentSlug,
  oddsBoost,
  myProfit,
  myRank,
  miniLeaderboard,
  currentUserId,
}: OfficialGroupCardProps) {
  const t = useTranslations("groups");

  return (
    <Card className="ring-2 ring-amber-500/50">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2">
          <Crown className="size-5 text-amber-500" />
          <CardTitle className="text-base">{groupName}</CardTitle>
          <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-700">
            {t("officialBadge")}
          </Badge>
        </div>
        <Link
          href={`/tournaments/${tournamentSlug}/groups/${groupSlug}`}
          className="text-muted-foreground text-xs hover:text-foreground"
        >
          {t("viewDetails")} →
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t("oddsBoost")}: <span className="font-mono text-amber-500">×{oddsBoost}</span>
          </span>
          <span className="text-muted-foreground">
            {t("myRank")}:{" "}
            <span className="font-bold font-mono">{myRank ? `#${myRank}` : "—"}</span> •{" "}
            {t("myProfit")}: <span className="font-bold font-mono text-amber-500">{myProfit}</span>
          </span>
        </div>
        {miniLeaderboard.length > 0 && (
          <div className="flex flex-col gap-1 border-border/40 border-t pt-2">
            {miniLeaderboard.map((row) => {
              const isCurrentUser = row.userId === currentUserId;
              return (
                <div
                  key={row.userId}
                  className={`flex items-center gap-2 px-2 py-1 text-xs ${
                    isCurrentUser ? "bg-amber-500/5" : ""
                  }`}
                >
                  <span className="w-6 font-mono">#{row.rank}</span>
                  <Avatar className="size-5">
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
      </CardContent>
    </Card>
  );
}
