"use client";

import { Circle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

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
    return <img src={logoUrl} alt={name} className="size-7 object-contain" />;
  }
  return (
    <span className="flex size-7 items-center justify-center rounded bg-muted font-mono text-[9px] font-bold">
      {name.slice(0, 3).toUpperCase()}
    </span>
  );
}

function BetBadge({ bet }: { bet: UserBet }) {
  if (bet.result1x2Correct === null) {
    return (
      <Badge variant="outline" className="bg-muted/50 font-mono text-xs">
        {bet.predictedHome}-{bet.predictedAway}
      </Badge>
    );
  }
  if (bet.result1x2Correct) {
    return (
      <Badge variant="outline" className="bg-emerald-500/10 font-mono text-xs text-emerald-500">
        {bet.predictedHome}-{bet.predictedAway}
        {bet.payout != null && ` +${bet.payout}`}
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="font-mono text-xs">
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
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col gap-1 rounded-lg border bg-card p-2.5 text-left transition-colors hover:bg-accent/50"
    >
      {isFinished || isLive ? (
        /* ── Finished / Live ── */
        <>
          {/* Row 1: status + time */}
          <div className="flex items-center justify-between">
            {isLive ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-red-500">
                <Circle className="size-1.5 animate-pulse fill-red-500 text-red-500" />
                {t("live")}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">{t("finished")}</span>
            )}
            <span className="font-mono text-xs text-muted-foreground">
              {formatTime(match.scheduledAt)}
            </span>
          </div>

          {/* Row 2-3: teams stacked with score */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <TeamLogo name={match.homeTeam.name} logoUrl={match.homeTeam.logoUrl} />
                <span className="text-sm font-medium">{match.homeTeam.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <TeamLogo name={match.awayTeam.name} logoUrl={match.awayTeam.logoUrl} />
                <span className="text-sm font-medium">{match.awayTeam.name}</span>
              </div>
            </div>
            <span className="font-mono text-2xl font-bold tabular-nums tracking-wider">
              {match.homeScore}-{match.awayScore}
            </span>
          </div>

          {/* Row 3: odds + bets */}
          <div className="flex items-center justify-between">
            {match.odds ? (
              <div className="flex gap-1.5 font-mono text-[11px] text-muted-foreground">
                <span>1:{match.odds.homeOdds}</span>
                <span>X:{match.odds.drawOdds}</span>
                <span>2:{match.odds.awayOdds}</span>
              </div>
            ) : (
              <span />
            )}
            {match.userBets.length > 0 && (
              <div className="flex gap-1">
                {match.userBets.map((bet) => (
                  <BetBadge key={bet.id} bet={bet} />
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        /* ── Scheduled ── */
        <>
          {/* Row 1: teams inline + time */}
          <div className="flex items-center gap-1.5">
            <TeamLogo name={match.homeTeam.name} logoUrl={match.homeTeam.logoUrl} />
            <span className="text-sm font-medium">{match.homeTeam.name}</span>
            <span className="mx-0.5 text-xs text-muted-foreground">{t("vs")}</span>
            <TeamLogo name={match.awayTeam.name} logoUrl={match.awayTeam.logoUrl} />
            <span className="text-sm font-medium">{match.awayTeam.name}</span>
            <span className="ml-auto font-mono text-xs text-muted-foreground">
              {formatTime(match.scheduledAt)}
            </span>
          </div>

          {/* Row 2: odds + bet badge */}
          <div className="flex items-center justify-between">
            {match.odds ? (
              <div className="flex gap-1.5 font-mono text-xs text-amber-600">
                <span>1:{match.odds.homeOdds}</span>
                <span>X:{match.odds.drawOdds}</span>
                <span>2:{match.odds.awayOdds}</span>
              </div>
            ) : (
              <span />
            )}
            {match.userBets.length > 0 ? (
              <div className="flex gap-1">
                {match.userBets.map((bet) => (
                  <BetBadge key={bet.id} bet={bet} />
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground/40">{t("noBet")}</span>
            )}
          </div>
        </>
      )}
    </button>
  );
}
