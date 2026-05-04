import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { TournamentLogo } from "@/components/tournament-logo";
import { TournamentTabs } from "@/components/tournament-tabs";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { pickMiniLeaderboard } from "@/lib/leaderboard-utils";
import { ensureOfficialMembership } from "@/lib/official-group";
import { getUserBetsForTournament } from "@/queries/bets";
import {
  getBatchProjectedBalances,
  getTopPublicGroupsForTournament,
  getUserGroups,
  type PublicGroupSuggestion,
} from "@/queries/groups";
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

  // Phase 1: auth + tournament lookup in parallel
  const [user, tournament, locale] = await Promise.all([
    getCurrentUser(),
    getTournamentBySlug(slug),
    getLocale(),
  ]);

  if (!user) {
    return redirect({ href: "/", locale });
  }
  if (!tournament) notFound();

  // Lazy auto-join to the tournament's official group. Idempotent.
  await ensureOfficialMembership(user.id, tournament.id);

  // Phase 2: all independent data in parallel
  const [matches, userBets, userGroupMemberships, tournamentTeams] = await Promise.all([
    getMatchesForTournament(tournament.id),
    getUserBetsForTournament(user.id, tournament.id),
    getUserGroups(user.id),
    getTournamentTeams(tournament.id),
  ]);

  const relevantGroups = userGroupMemberships.filter(
    (gm) => gm.group.tournamentId === tournament.id,
  );

  const officialGroupMembership = relevantGroups.find((gm) => gm.group.isOfficial);
  const userOnlyGroupMemberships = relevantGroups.filter((gm) => !gm.group.isOfficial);

  // Phase 2.5: top public groups if user has no CUSTOM groups for this tournament
  const topPublicGroups: PublicGroupSuggestion[] =
    userOnlyGroupMemberships.length === 0
      ? await getTopPublicGroupsForTournament(user.id, tournament.id, 2)
      : [];

  const groupsForBalance = relevantGroups.map((gm) => ({
    id: gm.group.id,
    initialTokens: gm.group.initialTokens,
    tokenPerMatch: gm.group.tokenPerMatch,
  }));

  // Phase 3: batch balance + podium + leaderboards in parallel
  const [batchBalances, existingPodiumBet, groupLeaderboards] = await Promise.all([
    getBatchProjectedBalances(user.id, groupsForBalance, matches),
    getPodiumBet(user.id, tournament.id).then((bet) =>
      bet
        ? {
            goldTeamId: bet.goldTeamId,
            silverTeamId: bet.silverTeamId,
            bronzeTeamId: bet.bronzeTeamId,
          }
        : null,
    ),
    Promise.all(
      relevantGroups.map(async (gm) => {
        const leaderboard = await getGroupLeaderboard(gm.group.id);
        const mini = pickMiniLeaderboard(leaderboard, user.id);
        const myEntry = leaderboard.find((e) => e.userId === user.id);
        return {
          groupId: gm.group.id,
          groupName: gm.group.name,
          groupSlug: gm.group.slug,
          tournamentSlug: tournament.slug,
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
    ),
  ]);

  // Build bet lookup: matchId -> bet[]
  const betsByMatch = new Map<string, typeof userBets>();
  for (const bet of userBets) {
    const existing = betsByMatch.get(bet.matchId) ?? [];
    betsByMatch.set(bet.matchId, [...existing, bet]);
  }

  // Build groupBetInfosByMatch from batch results
  const groupBetInfosByMatch: Record<
    string,
    {
      groupId: string;
      groupName: string;
      balance: number;
      projectedBalance: number;
      pendingDistributions: number;
      tokenPerMatch: number;
      oddsBoost: number;
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
    groupBetInfosByMatch[match.id] = relevantGroups.map((gm) => {
      const bal = batchBalances[match.id]?.[gm.group.id];
      const existingBet = matchBets.find((b) => b.groupId === gm.group.id);
      return {
        groupId: gm.group.id,
        groupName: gm.group.name,
        balance: bal?.actual ?? 0,
        projectedBalance: bal?.projected ?? 0,
        pendingDistributions: bal?.pending ?? 0,
        tokenPerMatch: bal?.tokenPerMatch ?? gm.group.tokenPerMatch,
        oddsBoost: gm.group.oddsBoost,
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

  const officialCard = officialGroupMembership
    ? (() => {
        const og = officialGroupMembership.group;
        const lb = groupLeaderboards.find((l) => l.groupId === og.id);
        return {
          groupId: og.id,
          groupName: og.name,
          groupSlug: og.slug,
          tournamentSlug: tournament.slug,
          oddsBoost: og.oddsBoost,
          tokenPerMatch: og.tokenPerMatch,
          myProfit: lb?.myProfit ?? 0,
          myRank: lb?.myRank ?? null,
          miniLeaderboard: lb?.miniLeaderboard ?? [],
        };
      })()
    : null;

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
        <h1 className="font-bold font-mono text-2xl tracking-tight">{tournament.name}</h1>
      </div>
      <TournamentTabs
        matches={matchesData}
        tournamentId={tournament.id}
        timezone={tournament.timezone}
        podiumLockDate={tournament.podiumLockDate.toISOString()}
        teams={tournamentTeams}
        existingPodiumBet={existingPodiumBet}
        groupBetInfosByMatch={groupBetInfosByMatch}
        groupLeaderboards={groupLeaderboards}
        currentUserId={user.id}
        topPublicGroups={topPublicGroups}
        officialCard={officialCard}
      />
    </div>
  );
}
