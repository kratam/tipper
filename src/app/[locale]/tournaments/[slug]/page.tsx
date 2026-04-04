import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { TournamentLogo } from "@/components/tournament-logo";
import { TournamentTabs } from "@/components/tournament-tabs";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { pickMiniLeaderboard } from "@/lib/leaderboard-utils";
import { getUserBetsForTournament } from "@/queries/bets";
import { getProjectedBalance, getUserGroups } from "@/queries/groups";
import { getGroupLeaderboard } from "@/queries/leaderboard";
import { getMatchesForTournament } from "@/queries/matches";
import { getPodiumBet, getTournamentTeams } from "@/queries/podium";
import { getTournamentBySlug } from "@/queries/tournaments";

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const locale = await getLocale();

  if (!user) {
    return redirect({ href: "/", locale });
  }

  const tournament = await getTournamentBySlug(slug);
  if (!tournament) notFound();

  const matches = await getMatchesForTournament(tournament.id);
  const userBets = await getUserBetsForTournament(user.id, tournament.id);

  // Build a bet lookup: matchId -> bet[]
  const betsByMatch = new Map<string, typeof userBets>();
  for (const bet of userBets) {
    const existing = betsByMatch.get(bet.matchId) ?? [];
    betsByMatch.set(bet.matchId, [...existing, bet]);
  }

  // User's group memberships for this tournament
  const userGroupMemberships = await getUserGroups(user.id);
  const relevantGroups = userGroupMemberships.filter(
    (gm) => gm.group.tournamentId === tournament.id,
  );

  // Build group bet info per match with projected balances
  const groupBetInfosByMatch: Record<
    string,
    {
      groupId: string;
      groupName: string;
      balance: number;
      projectedBalance: number;
      pendingDistributions: number;
      tokenPerMatch: number;
      existingBet: {
        id: string;
        predictedHome: number;
        predictedAway: number;
        stake: number;
      } | null;
    }[]
  > = {};

  for (const match of matches) {
    const matchBets = betsByMatch.get(match.id) ?? [];
    groupBetInfosByMatch[match.id] = await Promise.all(
      relevantGroups.map(async (gm) => {
        const existingBet = matchBets.find((b) => b.groupId === gm.group.id);
        const { projected, actual, pending, tokenPerMatch } = await getProjectedBalance(
          user.id,
          gm.group.id,
          match.id,
        );
        return {
          groupId: gm.group.id,
          groupName: gm.group.name,
          balance: actual,
          projectedBalance: projected,
          pendingDistributions: pending,
          tokenPerMatch,
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
  }

  // Podium data
  const tournamentTeams = await getTournamentTeams(tournament.id);
  const podiumData = await Promise.all(
    relevantGroups.map(async (gm) => {
      const existingBet = await getPodiumBet(user.id, tournament.id, gm.group.id);
      return {
        groupId: gm.group.id,
        groupName: gm.group.name,
        existingBet: existingBet
          ? {
              goldTeamId: existingBet.goldTeamId,
              silverTeamId: existingBet.silverTeamId,
              bronzeTeamId: existingBet.bronzeTeamId,
            }
          : null,
      };
    }),
  );

  // Mini leaderboard per group
  const groupLeaderboards = await Promise.all(
    relevantGroups.map(async (gm) => {
      const leaderboard = await getGroupLeaderboard(gm.group.id);
      const mini = pickMiniLeaderboard(leaderboard, user.id);
      const myEntry = leaderboard.find((e) => e.userId === user.id);
      return {
        groupId: gm.group.id,
        groupName: gm.group.name,
        groupSlug: gm.group.slug,
        myProfit: myEntry?.profit ?? 0,
        myRank: myEntry?.rank ?? null,
        miniLeaderboard: mini.map((e) => ({
          rank: e.rank,
          userId: e.userId,
          userName: e.userName,
          profit: e.profit,
        })),
      };
    }),
  );

  // Serialize matches for client component
  const matchesData = matches.map((m) => ({
    id: m.id,
    homeTeam: {
      name: m.homeTeam.name,
      logoUrl: m.homeTeam.logoUrl,
    },
    awayTeam: {
      name: m.awayTeam.name,
      logoUrl: m.awayTeam.logoUrl,
    },
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    status: m.status,
    scheduledAt: m.scheduledAt.toISOString(),
    round: m.round,
    odds: m.odds[0]
      ? {
          homeOdds: m.odds[0].homeOdds,
          drawOdds: m.odds[0].drawOdds,
          awayOdds: m.odds[0].awayOdds,
        }
      : null,
    userBets: (betsByMatch.get(m.id) ?? []).map((b) => ({
      id: b.id,
      predictedHome: b.predictedHome,
      predictedAway: b.predictedAway,
      stake: b.stake,
      result1x2Correct: b.result1x2Correct,
      goalDiffCorrect: b.goalDiffCorrect,
      exactScoreCorrect: b.exactScoreCorrect,
      payout: b.payout,
      groupName: b.group.name,
    })),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        {tournament.logoUrl && (
          <TournamentLogo src={tournament.logoUrl} alt={tournament.name} size={40} />
        )}
        <h1 className="font-mono text-2xl font-bold tracking-tight">{tournament.name}</h1>
      </div>
      <TournamentTabs
        matches={matchesData}
        tournamentId={tournament.id}
        podiumLockDate={tournament.podiumLockDate.toISOString()}
        teams={tournamentTeams}
        podiumGroups={podiumData}
        groupBetInfosByMatch={groupBetInfosByMatch}
        groupLeaderboards={groupLeaderboards}
        currentUserId={user.id}
      />
    </div>
  );
}
