"use client";

import { Circle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FormattedDate } from "@/components/formatted-date";

interface MatchOdds {
  homeOdds: string;
  drawOdds: string;
  awayOdds: string;
}

interface UserBet {
  id: string;
  predictedHome: number;
  predictedAway: number;
  stake: number;
  result1x2Correct: boolean | null;
  goalDiffCorrect: boolean | null;
  exactScoreCorrect: boolean | null;
  payout: number | null;
  groupName: string;
}

export interface MatchCardData {
  id: string;
  homeTeam: { name: string; logoUrl: string | null };
  awayTeam: { name: string; logoUrl: string | null };
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  scheduledAt: string;
  round: string;
  odds: MatchOdds | null;
  userBets: UserBet[];
}

function TeamLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  if (logoUrl) {
    return <img src={logoUrl} alt={name} className="size-5 rounded-sm object-contain" />;
  }
  return (
    <span className="flex size-5 items-center justify-center rounded-sm bg-muted font-mono text-[8px] font-bold">
      {name.slice(0, 3).toUpperCase()}
    </span>
  );
}

function BetBadge({ bet }: { bet: UserBet }) {
  if (bet.result1x2Correct === null) {
    return (
      <Badge variant="outline" className="bg-muted/50 font-mono text-[11px]">
        {bet.predictedHome}-{bet.predictedAway}
      </Badge>
    );
  }
  if (bet.result1x2Correct) {
    return (
      <Badge variant="outline" className="bg-emerald-500/10 font-mono text-[11px] text-emerald-500">
        {bet.predictedHome}-{bet.predictedAway}
        {bet.payout != null && ` +${bet.payout}`}
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="font-mono text-[11px]">
      {bet.predictedHome}-{bet.predictedAway}
    </Badge>
  );
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface MatchCardProps {
  match: MatchCardData;
  onClick: () => void;
}

export function MatchCard({ match, onClick }: MatchCardProps) {
  const t = useTranslations("matches");
  const isFinished = match.status === "finished";
  const isLive = match.status === "live";

  return (
    <Card
      className="cursor-pointer transition-colors hover:ring-1 hover:ring-foreground/20"
      onClick={onClick}
    >
      <CardContent className="flex flex-col gap-2 p-3">
        {/* Header: time + status */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] text-muted-foreground">
            {formatTime(match.scheduledAt)}
          </span>
          {isLive && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-red-500">
              <Circle className="size-1.5 animate-pulse fill-red-500 text-red-500" />
              {t("live")}
            </span>
          )}
          {isFinished && (
            <span className="text-[11px] text-muted-foreground">{t("finished")}</span>
          )}
        </div>

        {/* Teams + score/vs */}
        {isFinished || isLive ? (
          /* Finished/Live: teams stacked, score on right */
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <TeamLogo name={match.homeTeam.name} logoUrl={match.homeTeam.logoUrl} />
                <span className="text-sm font-medium">{match.homeTeam.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <TeamLogo name={match.awayTeam.name} logoUrl={match.awayTeam.logoUrl} />
                <span className="text-sm font-medium">{match.awayTeam.name}</span>
              </div>
            </div>
            <span className="font-mono text-xl font-bold tabular-nums tracking-wider">
              {match.homeScore} - {match.awayScore}
            </span>
          </div>
        ) : (
          /* Scheduled: teams inline with "vs" */
          <div className="flex items-center gap-1.5">
            <TeamLogo name={match.homeTeam.name} logoUrl={match.homeTeam.logoUrl} />
            <span className="text-sm font-medium">{match.homeTeam.name}</span>
            <span className="px-1 text-xs text-muted-foreground">{t("vs")}</span>
            <TeamLogo name={match.awayTeam.name} logoUrl={match.awayTeam.logoUrl} />
            <span className="text-sm font-medium">{match.awayTeam.name}</span>
          </div>
        )}

        {/* Odds */}
        {match.odds && (
          <div className="flex gap-2 font-mono text-[11px]">
            <span className={isFinished ? "text-muted-foreground" : "text-amber-500"}>
              1: {match.odds.homeOdds}
            </span>
            <span className={isFinished ? "text-muted-foreground" : "text-amber-500"}>
              X: {match.odds.drawOdds}
            </span>
            <span className={isFinished ? "text-muted-foreground" : "text-amber-500"}>
              2: {match.odds.awayOdds}
            </span>
          </div>
        )}

        {/* Bet badges */}
        {match.userBets.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            {match.userBets.map((bet) => (
              <BetBadge key={bet.id} bet={bet} />
            ))}
          </div>
        ) : (
          !isFinished && !isLive && (
            <span className="text-[11px] text-muted-foreground/50">{t("noBet")}</span>
          )
        )}
      </CardContent>
    </Card>
  );
}
