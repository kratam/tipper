import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { TournamentTabs } from "@/components/tournament-tabs";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { getUserBetsForTournament } from "@/queries/bets";
import { getTokenBalance, getUserGroups } from "@/queries/groups";
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

  // Fetch token balances for each group
  const groupBalances = await Promise.all(
    relevantGroups.map(async (gm) => ({
      groupId: gm.group.id,
      groupName: gm.group.name,
      balance: await getTokenBalance(user.id, gm.group.id),
    })),
  );

  // Build group bet info per match (for the BetDialog)
  const groupBetInfosByMatch: Record<
    string,
    {
      groupId: string;
      groupName: string;
      balance: number;
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
    groupBetInfosByMatch[match.id] = groupBalances.map((gb) => {
      const existingBet = matchBets.find((b) => b.groupId === gb.groupId);
      return {
        groupId: gb.groupId,
        groupName: gb.groupName,
        balance: gb.balance,
        existingBet: existingBet
          ? {
              id: existingBet.id,
              predictedHome: existingBet.predictedHome,
              predictedAway: existingBet.predictedAway,
              stake: existingBet.stake,
            }
          : null,
      };
    });
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
      <h1 className="font-mono text-2xl font-bold tracking-tight">{tournament.name}</h1>
      <TournamentTabs
        matches={matchesData}
        tournamentId={tournament.id}
        podiumLockDate={tournament.podiumLockDate.toISOString()}
        teams={tournamentTeams}
        podiumGroups={podiumData}
        groupBetInfosByMatch={groupBetInfosByMatch}
      />
    </div>
  );
}
