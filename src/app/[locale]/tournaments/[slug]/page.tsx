import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Crown } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getLiveMatchData } from "@/actions/live";
import type { BoardTab } from "@/components/tournament-board-panel";
import { TournamentLogo } from "@/components/tournament-logo";
import { TournamentTabs } from "@/components/tournament-tabs";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { filterAndRerankLeaderboard } from "@/lib/circle-leaderboard";
import { hideInactiveAndRerank, pickMiniLeaderboard } from "@/lib/leaderboard-utils";
import { liveKeys } from "@/lib/live/query-keys";
import { ensureOfficialMembership } from "@/lib/official-group";
import { getQueryClient } from "@/lib/query-client";
import { loadBadgesForUsers } from "@/queries/badges";
import { getUserBetsForTournament } from "@/queries/bets";
import { getUserCircles } from "@/queries/circles";
import { getGroupClassicPoints } from "@/queries/classic-points";
import {
  getBatchProjectedBalances,
  getTopPublicGroupsForTournament,
  getUserGroups,
  type PublicGroupSuggestion,
} from "@/queries/groups";
import { getGroupLeaderboard } from "@/queries/leaderboard";
import { getMatchesForTournament } from "@/queries/matches";
import { getPodiumBet, getTournamentTeams } from "@/queries/podium";
import { getGroupPodiumData, getPodiumBonusByGroup } from "@/queries/podium-results";
import { loadPlayerStatsForUsers } from "@/queries/profile";
import { matchParticipantsKnown } from "@/queries/team-display";
import { getTipMatrixRound, type TipMatrixRound } from "@/queries/tip-matrix";
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
  // Pass the already-loaded timezone so it doesn't re-query the tournament.
  await ensureOfficialMembership(user.id, tournament.id, tournament.timezone);

  // Phase 2: all independent data in parallel
  const [matches, userBets, userGroupMemberships, tournamentTeams, userCircles] = await Promise.all(
    [
      getMatchesForTournament(tournament.id, tournament.useFlagFallback),
      getUserBetsForTournament(user.id, tournament.id, tournament.useFlagFallback),
      getUserGroups(user.id),
      getTournamentTeams(tournament.id, tournament.useFlagFallback),
      getUserCircles(user.id),
    ],
  );

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
    getBatchProjectedBalances(user.id, groupsForBalance, matches, tournament.timezone),
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
        const [rawLeaderboard, classicByUser] = await Promise.all([
          getGroupLeaderboard(gm.group.id),
          getGroupClassicPoints(gm.group.id),
        ]);
        const leaderboard = hideInactiveAndRerank(rawLeaderboard);
        const mini = pickMiniLeaderboard(leaderboard, user.id, gm.group.isOfficial ? 5 : 3);
        const myEntry = leaderboard.find((e) => e.userId === user.id);
        return {
          groupId: gm.group.id,
          groupName: gm.group.name,
          groupSlug: gm.group.slug,
          tournamentSlug: tournament.slug,
          isOfficial: gm.group.isOfficial,
          myProfit: myEntry?.profit ?? 0,
          myRank: myEntry?.rank ?? null,
          rawLeaderboard,
          classicByUser,
          fullLeaderboard: leaderboard.map((e) => ({
            rank: e.rank,
            userId: e.userId,
            userName: e.userName,
            userAvatarUrl: e.userAvatarUrl,
            gravatarHash: e.gravatarHash,
            profit: e.profit,
            classicPoints: classicByUser.get(e.userId) ?? 0,
          })),
          miniLeaderboard: mini.map((e) => ({
            rank: e.rank,
            userId: e.userId,
            userName: e.userName,
            userAvatarUrl: e.userAvatarUrl,
            gravatarHash: e.gravatarHash,
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
      initialTokens: number;
      eligibleMatchCount: number;
      winnings: number;
      losses: number;
      otherActiveStakes: number;
      oddsBoost: number;
      lossPercentage: number;
      bonusGoalDiffPct: number;
      bonusExactScorePct: number;
      bonusPodiumMentionPct: number;
      bonusPodiumExactPct: number;
      existingBet: {
        id: string;
        predictedHome: number;
        predictedAway: number;
        stake: number;
        oddsAtBet: string | null;
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
        initialTokens: bal?.initialTokens ?? gm.group.initialTokens,
        eligibleMatchCount: bal?.eligibleMatchCount ?? 0,
        winnings: bal?.winnings ?? 0,
        losses: bal?.losses ?? 0,
        otherActiveStakes: bal?.otherActiveStakes ?? 0,
        oddsBoost: gm.group.oddsBoost,
        lossPercentage: gm.group.lossPercentage,
        bonusGoalDiffPct: gm.group.bonusGoalDiffPct,
        bonusExactScorePct: gm.group.bonusExactScorePct,
        bonusPodiumMentionPct: gm.group.bonusPodiumMentionPct,
        bonusPodiumExactPct: gm.group.bonusPodiumExactPct,
        existingBet: existingBet
          ? {
              id: existingBet.id,
              predictedHome: existingBet.predictedHome,
              predictedAway: existingBet.predictedAway,
              stake: existingBet.stake,
              oddsAtBet: existingBet.oddsAtBet,
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
          tokenPerMatch: og.tokenPerMatch,
          initialTokens: og.initialTokens,
          bonusGoalDiffPct: og.bonusGoalDiffPct,
          bonusExactScorePct: og.bonusExactScorePct,
          bonusPodiumMentionPct: og.bonusPodiumMentionPct,
          bonusPodiumExactPct: og.bonusPodiumExactPct,
          oddsBoost: og.oddsBoost,
          lossPercentage: og.lossPercentage,
          myProfit: lb?.myProfit ?? 0,
          myRank: lb?.myRank ?? null,
          miniLeaderboard: lb?.miniLeaderboard ?? [],
        };
      })()
    : null;

  // Körök a hivatalos csoport tippjeire épülnek — a teljes ranglista már megvan a groupLeaderboards-ban.
  const officialGroup = officialGroupMembership?.group;

  const officialInitialRound: TipMatrixRound | null = officialGroup
    ? await getTipMatrixRound(
        officialGroup.id,
        tournament.id,
        tournament.useFlagFallback,
        user.id,
        null,
      )
    : null;

  const officialRawLeaderboard = officialGroup
    ? (groupLeaderboards.find((l) => l.groupId === officialGroup.id)?.rawLeaderboard ?? [])
    : [];

  // A dobogó-fül lezárás utáni nézete a hivatalos csoport tippjeit és
  // bónusz-egységeit mutatja — ugyanaz a kör, mint a board-panel alap nézete.
  const podiumResults = officialGroup
    ? await getGroupPodiumData(tournament.id, officialGroup.id)
    : null;

  // A mátrix záró oszlopa minden board-tabhoz (tabonként más csoport).
  const podiumBonusByGroup = await getPodiumBonusByGroup(
    tournament.id,
    relevantGroups.map((gm) => gm.group.id),
  );

  // BoardTab összeállítása: hivatalos → saját csoportok → körök
  const groupTabs: BoardTab[] = [];
  // Hivatalos elsőként
  if (officialGroup) {
    const og = groupLeaderboards.find((l) => l.groupId === officialGroup.id);
    groupTabs.push({
      key: "official",
      label: officialGroup.name,
      groupId: officialGroup.id,
      leaderboard: og?.fullLeaderboard ?? [],
      detailHref: `/tournaments/${tournament.slug}/groups/${officialGroup.slug}`,
      readOnly: false,
      rules: {
        tokenPerMatch: officialGroup.tokenPerMatch,
        initialTokens: officialGroup.initialTokens,
        bonusGoalDiffPct: officialGroup.bonusGoalDiffPct,
        bonusExactScorePct: officialGroup.bonusExactScorePct,
        bonusPodiumMentionPct: officialGroup.bonusPodiumMentionPct,
        bonusPodiumExactPct: officialGroup.bonusPodiumExactPct,
        oddsBoost: officialGroup.oddsBoost,
        lossPercentage: officialGroup.lossPercentage,
      },
      rulesGroupName: officialGroup.name,
    });
  }
  // Saját csoportok
  for (const gm of userOnlyGroupMemberships) {
    const gl = groupLeaderboards.find((l) => l.groupId === gm.group.id);
    groupTabs.push({
      key: `group-${gm.group.id}`,
      label: gm.group.name,
      groupId: gm.group.id,
      leaderboard: gl?.fullLeaderboard ?? [],
      detailHref: `/tournaments/${tournament.slug}/groups/${gm.group.slug}`,
      readOnly: false,
      rules: {
        tokenPerMatch: gm.group.tokenPerMatch,
        initialTokens: gm.group.initialTokens,
        bonusGoalDiffPct: gm.group.bonusGoalDiffPct,
        bonusExactScorePct: gm.group.bonusExactScorePct,
        bonusPodiumMentionPct: gm.group.bonusPodiumMentionPct,
        bonusPodiumExactPct: gm.group.bonusPodiumExactPct,
        oddsBoost: gm.group.oddsBoost,
        lossPercentage: gm.group.lossPercentage,
      },
      rulesGroupName: gm.group.name,
    });
  }
  // Körök (a hivatalos csoport tippjeire épülnek, read-only)
  if (officialGroup) {
    // A kör klasszikus pontjai a hivatalos csoport klasszikus pontjaiból jönnek
    // (a kör read-only vetülete a hivatalos ranglistának).
    const officialClassicByUser =
      groupLeaderboards.find((l) => l.groupId === officialGroup.id)?.classicByUser ??
      new Map<string, number>();
    for (const circle of userCircles) {
      const memberIds = new Set(circle.members.map((m) => m.userId));
      const filtered = filterAndRerankLeaderboard(officialRawLeaderboard, memberIds);
      groupTabs.push({
        key: `circle-${circle.id}`,
        label: circle.name,
        groupId: officialGroup.id,
        leaderboard: filtered.map((e) => ({
          rank: e.rank,
          userId: e.userId,
          userName: e.userName,
          userAvatarUrl: e.userAvatarUrl,
          gravatarHash: e.gravatarHash,
          profit: e.profit,
          classicPoints: officialClassicByUser.get(e.userId) ?? 0,
        })),
        detailHref: `/tournaments/${tournament.slug}/circles/${circle.slug}`,
        readOnly: true,
        rules: null,
        rulesGroupName: null,
      });
    }
  }

  // Collect all user IDs appearing in any board tab leaderboard, load their badges in one query
  const allUserIds = [...new Set(groupTabs.flatMap((tab) => tab.leaderboard.map((e) => e.userId)))];
  const [badgesMap, statsMap] = await Promise.all([
    loadBadgesForUsers(allUserIds),
    loadPlayerStatsForUsers(allUserIds),
  ]);
  const userBadges = Object.fromEntries(
    [...badgesMap.entries()].map(([uid, b]) => [
      uid,
      b.map((x) => ({ badgeKey: x.badgeKey, tier: x.tier })),
    ]),
  );
  const userStats = Object.fromEntries([...statsMap.entries()]);

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: liveKeys.matches(tournament.id),
    queryFn: () => getLiveMatchData(tournament.id),
  });

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
    participantsKnown: matchParticipantsKnown(m.homeTeam.name, m.awayTeam.name),
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
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="flex flex-col gap-4">
        <div className="mt-1.5 mb-2 flex items-center gap-3.5">
          {tournament.logoUrl ? (
            <span className="grid size-[46px] place-items-center rounded-xl bg-linear-to-br from-gold to-gold-2 shadow-[0_8px_20px_-8px_var(--gold-2)]">
              <TournamentLogo src={tournament.logoUrl} alt={tournament.name} size={32} />
            </span>
          ) : (
            <span className="grid size-[46px] place-items-center rounded-xl bg-linear-to-br from-gold to-gold-2 text-gold-ink shadow-[0_8px_20px_-8px_var(--gold-2)]">
              <Crown className="size-6" />
            </span>
          )}
          <h1 className="font-bold font-mono text-[27px] tracking-[0.01em]">{tournament.name}</h1>
        </div>
        <TournamentTabs
          matches={matchesData}
          tournamentId={tournament.id}
          timezone={tournament.timezone}
          podiumLockDate={tournament.podiumLockDate.toISOString()}
          teams={tournamentTeams}
          existingPodiumBet={existingPodiumBet}
          podiumResults={podiumResults}
          podiumBonusByGroup={podiumBonusByGroup}
          groupBetInfosByMatch={groupBetInfosByMatch}
          groupLeaderboards={groupLeaderboards}
          currentUserId={user.id}
          topPublicGroups={topPublicGroups}
          officialCard={officialCard}
          boardTabs={groupTabs}
          officialInitialRound={officialInitialRound}
          userBadges={userBadges}
          userStats={userStats}
        />
      </div>
    </HydrationBoundary>
  );
}
