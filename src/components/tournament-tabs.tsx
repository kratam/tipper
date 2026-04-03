"use client";

import { Circle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PodiumForm } from "@/components/podium-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/utils";

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

interface MatchData {
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

interface TeamOption {
  id: string;
  name: string;
  logoUrl: string | null;
}

interface PodiumGroupData {
  groupId: string;
  groupName: string;
  existingBet: {
    goldTeamId: string;
    silverTeamId: string;
    bronzeTeamId: string;
  } | null;
}

interface TournamentTabsProps {
  tournamentSlug: string;
  matches: MatchData[];
  tournamentId: string;
  podiumLockDate: string;
  teams: TeamOption[];
  podiumGroups: PodiumGroupData[];
}

function TeamDisplay({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  return (
    <div className="flex items-center gap-2">
      {logoUrl ? (
        <img src={logoUrl} alt={name} className="size-6 rounded-sm object-contain" />
      ) : (
        <span className="flex size-6 items-center justify-center rounded-sm bg-muted font-mono text-[10px] font-bold">
          {name.slice(0, 3).toUpperCase()}
        </span>
      )}
      <span className="text-sm font-medium">{name}</span>
    </div>
  );
}

function BetIndicator({ bet }: { bet: UserBet }) {
  if (bet.result1x2Correct === null) {
    return (
      <Badge variant="outline" className="bg-muted/50 font-mono text-xs">
        {bet.predictedHome} - {bet.predictedAway}
      </Badge>
    );
  }
  if (bet.result1x2Correct) {
    return (
      <Badge variant="outline" className="bg-emerald-500/10 font-mono text-xs text-emerald-500">
        {bet.predictedHome} - {bet.predictedAway}
        {bet.payout != null && ` (+${bet.payout})`}
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="font-mono text-xs">
      {bet.predictedHome} - {bet.predictedAway}
    </Badge>
  );
}

function MatchStatusIndicator({ status }: { status: string }) {
  const tMatches = useTranslations("matches");

  if (status === "live") {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-red-500">
        <Circle className="size-2 animate-pulse fill-red-500 text-red-500" />
        {tMatches("live")}
      </span>
    );
  }
  if (status === "finished") {
    return <span className="text-xs text-muted-foreground">{tMatches("finished")}</span>;
  }
  return null;
}

export function TournamentTabs({
  tournamentSlug,
  matches,
  tournamentId,
  podiumLockDate,
  teams,
  podiumGroups,
}: TournamentTabsProps) {
  const t = useTranslations("tournaments");
  const tMatches = useTranslations("matches");
  const tPodium = useTranslations("podium");
  const locale = useLocale();

  // Group matches by round
  const roundMap = new Map<string, MatchData[]>();
  for (const match of matches) {
    const existing = roundMap.get(match.round) ?? [];
    roundMap.set(match.round, [...existing, match]);
  }

  const isLocked = new Date() > new Date(podiumLockDate);

  return (
    <Tabs defaultValue="matches">
      <TabsList>
        <TabsTrigger value="matches">{t("matches")}</TabsTrigger>
        <TabsTrigger value="podium">{t("podium")}</TabsTrigger>
      </TabsList>

      <TabsContent value="matches" className="mt-4 flex flex-col gap-6">
        {matches.length === 0 ? (
          <p className="text-muted-foreground">{tMatches("noMatches")}</p>
        ) : (
          Array.from(roundMap.entries()).map(([round, roundMatches]) => (
            <div key={round} className="flex flex-col gap-3">
              <h3 className="font-mono text-sm font-medium text-muted-foreground">
                {tMatches("round", { round })}
              </h3>
              <div className="flex flex-col gap-2">
                {roundMatches.map((match) => (
                  <Link key={match.id} href={`/tournaments/${tournamentSlug}/matches/${match.id}`}>
                    <Card className="cursor-pointer transition-colors hover:ring-foreground/20">
                      <CardContent className="flex flex-col gap-3 p-4">
                        {/* Header: time + status */}
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-muted-foreground">
                            {formatDate(match.scheduledAt, locale)}
                          </span>
                          <MatchStatusIndicator status={match.status} />
                        </div>

                        {/* Teams + Score */}
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex flex-1 flex-col gap-2">
                            <TeamDisplay
                              name={match.homeTeam.name}
                              logoUrl={match.homeTeam.logoUrl}
                            />
                            <TeamDisplay
                              name={match.awayTeam.name}
                              logoUrl={match.awayTeam.logoUrl}
                            />
                          </div>

                          {/* Score or Odds */}
                          <div className="flex flex-col items-center gap-1">
                            {match.status === "finished" || match.status === "live" ? (
                              <div className="font-mono text-2xl font-bold tracking-wider">
                                {match.homeScore} - {match.awayScore}
                              </div>
                            ) : match.odds ? (
                              <div className="flex gap-2 font-mono text-xs">
                                <span className="rounded bg-muted px-2 py-1 text-amber-500">
                                  {match.odds.homeOdds}
                                </span>
                                <span className="rounded bg-muted px-2 py-1 text-amber-500">
                                  {match.odds.drawOdds}
                                </span>
                                <span className="rounded bg-muted px-2 py-1 text-amber-500">
                                  {match.odds.awayOdds}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {/* User bets */}
                        {match.userBets.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
                            {match.userBets.map((bet) => (
                              <div key={bet.id} className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">
                                  {bet.groupName}:
                                </span>
                                <BetIndicator bet={bet} />
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </TabsContent>

      <TabsContent value="podium" className="mt-4 flex flex-col gap-4">
        {podiumGroups.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              {tPodium("title")}
            </CardContent>
          </Card>
        ) : (
          podiumGroups.map((pg) => (
            <PodiumForm
              key={pg.groupId}
              tournamentId={tournamentId}
              groupId={pg.groupId}
              groupName={pg.groupName}
              teams={teams}
              existingBet={pg.existingBet}
              isLocked={isLocked}
            />
          ))
        )}
      </TabsContent>
    </Tabs>
  );
}
