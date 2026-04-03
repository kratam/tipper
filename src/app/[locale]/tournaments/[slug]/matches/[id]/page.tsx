import { ArrowLeft, Circle } from "lucide-react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { BetForm } from "@/components/bet-form";
import { FormattedDate } from "@/components/formatted-date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link, redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { getUserBetsForMatch } from "@/queries/bets";
import { getTokenBalance, getUserGroups } from "@/queries/groups";
import { getMatchById } from "@/queries/matches";

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string; locale: string }>;
}) {
  const { slug, id } = await params;
  const user = await getCurrentUser();
  const locale = await getLocale();

  if (!user) {
    return redirect({ href: "/", locale });
  }

  const t = await getTranslations();
  const match = await getMatchById(id);
  if (!match) notFound();

  const userBets = await getUserBetsForMatch(user.id, id);
  const userGroupMemberships = await getUserGroups(user.id);

  // Filter groups that belong to this tournament
  const relevantGroups = userGroupMemberships.filter(
    (gm) => gm.group.tournamentId === match.tournamentId,
  );

  // Build group info with balances
  const groupBetInfos = await Promise.all(
    relevantGroups.map(async (gm) => {
      const balance = await getTokenBalance(user.id, gm.group.id);
      const existingBet = userBets.find((b) => b.groupId === gm.group.id);
      return {
        groupId: gm.group.id,
        groupName: gm.group.name,
        balance,
        existingBet: existingBet
          ? {
              id: existingBet.id,
              predictedHome: existingBet.predictedHome,
              predictedAway: existingBet.predictedAway,
              stake: existingBet.stake,
            }
          : null,
      };
    }),
  );

  const latestOdds = match.odds[0]
    ? {
        homeOdds: match.odds[0].homeOdds,
        drawOdds: match.odds[0].drawOdds,
        awayOdds: match.odds[0].awayOdds,
      }
    : null;

  const matchStarted =
    match.status === "live" ||
    match.status === "finished" ||
    new Date(match.scheduledAt) <= new Date();

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <Button variant="ghost" size="sm" className="w-fit gap-2" asChild>
        <Link href={`/tournaments/${slug}`}>
          <ArrowLeft className="size-4" />
          {t("common.back")}
        </Link>
      </Button>

      {/* Match header */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-muted-foreground">
              <FormattedDate date={match.scheduledAt.toISOString()} />
            </span>
            {match.status === "live" && (
              <span className="flex items-center gap-1 text-xs font-medium text-red-500">
                <Circle className="size-2 animate-pulse fill-red-500 text-red-500" />
                {t("matches.live")}
              </span>
            )}
            {match.status === "finished" && (
              <Badge variant="outline" className="text-muted-foreground">
                {t("matches.finished")}
              </Badge>
            )}
          </div>

          {/* Teams */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-1 flex-col items-center gap-2">
              {match.homeTeam.logoUrl ? (
                <Image
                  src={match.homeTeam.logoUrl}
                  alt={match.homeTeam.name}
                  width={48}
                  height={48}
                  className="size-12 rounded object-contain"
                />
              ) : (
                <span className="flex size-12 items-center justify-center rounded bg-muted font-mono text-sm font-bold">
                  {match.homeTeam.name.slice(0, 3).toUpperCase()}
                </span>
              )}
              <span className="text-center text-sm font-medium">{match.homeTeam.name}</span>
            </div>

            <div className="flex flex-col items-center gap-1">
              {match.status === "finished" || match.status === "live" ? (
                <span className="font-mono text-4xl font-bold tracking-wider">
                  {match.homeScore} - {match.awayScore}
                </span>
              ) : (
                <span className="font-mono text-2xl text-muted-foreground">{t("matches.vs")}</span>
              )}
            </div>

            <div className="flex flex-1 flex-col items-center gap-2">
              {match.awayTeam.logoUrl ? (
                <Image
                  src={match.awayTeam.logoUrl}
                  alt={match.awayTeam.name}
                  width={48}
                  height={48}
                  className="size-12 rounded object-contain"
                />
              ) : (
                <span className="flex size-12 items-center justify-center rounded bg-muted font-mono text-sm font-bold">
                  {match.awayTeam.name.slice(0, 3).toUpperCase()}
                </span>
              )}
              <span className="text-center text-sm font-medium">{match.awayTeam.name}</span>
            </div>
          </div>

          {/* Odds row */}
          {latestOdds && (
            <div className="flex justify-center gap-4 pt-2">
              <div className="flex flex-col items-center rounded-lg bg-muted px-4 py-2 font-mono">
                <span className="text-xs text-muted-foreground">1</span>
                <span className="text-lg font-bold text-amber-500">{latestOdds.homeOdds}</span>
              </div>
              <div className="flex flex-col items-center rounded-lg bg-muted px-4 py-2 font-mono">
                <span className="text-xs text-muted-foreground">X</span>
                <span className="text-lg font-bold text-amber-500">{latestOdds.drawOdds}</span>
              </div>
              <div className="flex flex-col items-center rounded-lg bg-muted px-4 py-2 font-mono">
                <span className="text-xs text-muted-foreground">2</span>
                <span className="text-lg font-bold text-amber-500">{latestOdds.awayOdds}</span>
              </div>
            </div>
          )}

          {/* Show existing bets if match is finished/live */}
          {matchStarted && userBets.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <span className="text-sm font-medium">{t("matches.yourBet")}</span>
              {userBets.map((bet) => {
                const betColor =
                  bet.result1x2Correct === null
                    ? "bg-muted/50"
                    : bet.result1x2Correct
                      ? "bg-emerald-500/10 text-emerald-500"
                      : "bg-destructive/10 text-destructive";
                return (
                  <div
                    key={bet.id}
                    className={`flex items-center justify-between rounded-lg p-3 ${betColor}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{bet.group.name}</span>
                      <span className="font-mono text-sm font-bold">
                        {bet.predictedHome} - {bet.predictedAway}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span>
                        {t("betting.stake")}: {bet.stake}
                      </span>
                      {bet.payout != null && (
                        <Badge variant="outline" className="font-mono text-emerald-500">
                          +{bet.payout}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Betting form */}
      <BetForm matchId={id} groups={groupBetInfos} odds={latestOdds} matchStarted={matchStarted} />
    </div>
  );
}
