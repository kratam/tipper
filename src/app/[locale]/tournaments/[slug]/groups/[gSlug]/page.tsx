import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { GroupDetailTabs } from "@/components/group-detail-tabs";
import { GroupPageHeader } from "@/components/group-page-header";
import { InviteCodeBadge } from "@/components/invite-code-badge";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { hideInactiveAndRerank } from "@/lib/leaderboard-utils";
import { loadBadgesForUsers } from "@/queries/badges";
import { getGroupBetsForFinishedMatches } from "@/queries/bets";
import { getGroupBySlug } from "@/queries/groups";
import { getGroupLeaderboard } from "@/queries/leaderboard";
import {
  getFinishedMatchesForTournament,
  getTournamentMatchTimes,
  getUpcomingBetSummary,
} from "@/queries/matches";
import { loadPlayerStatsForUsers } from "@/queries/profile";
import { getTipMatrixRound } from "@/queries/tip-matrix";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ slug: string; gSlug: string; locale: string }>;
}) {
  const { slug: tournamentSlug, gSlug: groupSlug } = await params;
  const user = await getCurrentUser();
  const locale = await getLocale();

  if (!user) {
    return redirect({ href: "/", locale });
  }

  const group = await getGroupBySlug(tournamentSlug, groupSlug);
  if (!group) notFound();

  const memberIds = group.members.map((m) => m.userId);

  const [
    leaderboardRaw,
    finishedMatches,
    groupBetsRaw,
    upcomingDays,
    matchTimes,
    initialMatrixRound,
    badgesMap,
    statsMap,
  ] = await Promise.all([
    getGroupLeaderboard(group.id),
    getFinishedMatchesForTournament(group.tournamentId, group.tournament.useFlagFallback),
    getGroupBetsForFinishedMatches(group.id),
    getUpcomingBetSummary(
      group.tournamentId,
      group.id,
      user.id,
      group.tournament.timezone,
      locale,
      group.tournament.useFlagFallback,
    ),
    getTournamentMatchTimes(group.tournamentId),
    getTipMatrixRound(
      group.id,
      group.tournamentId,
      group.tournament.useFlagFallback,
      user.id,
      null,
    ),
    loadBadgesForUsers(memberIds),
    loadPlayerStatsForUsers(memberIds),
  ]);

  const leaderboard = hideInactiveAndRerank(leaderboardRaw);
  // Convert Map → plain object before crossing the server→client boundary
  const userBadges = Object.fromEntries(
    [...badgesMap.entries()].map(([uid, badges]) => [
      uid,
      badges.map((b) => ({ badgeKey: b.badgeKey, tier: b.tier })),
    ]),
  );
  const userStats = Object.fromEntries([...statsMap.entries()]);

  const isOwner = group.ownerId === user.id;
  const canEditSettings = isOwner || (user.isAdmin && group.isOfficial);
  const isMember = group.members.some((m) => m.userId === user.id);

  if (!isMember) {
    notFound();
  }

  const groupRules = {
    tokenPerMatch: group.tokenPerMatch,
    initialTokens: group.initialTokens,
    bonusGoalDiff: group.bonusGoalDiff,
    bonusExactScore: group.bonusExactScore,
    bonusPodiumMention: group.bonusPodiumMention,
    bonusPodiumExact: group.bonusPodiumExact,
    oddsBoost: group.oddsBoost,
    lossPercentage: group.lossPercentage,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <GroupPageHeader
          tournamentName={group.tournament.name}
          tournamentSlug={group.tournament.slug}
          tournamentLogoUrl={group.tournament.logoUrl}
          groupName={group.name}
          rules={groupRules}
          days={upcomingDays}
        />
        {!group.isOfficial && (
          <div className="flex justify-end">
            <InviteCodeBadge inviteCode={group.inviteCode} />
          </div>
        )}
      </div>

      <GroupDetailTabs
        groupId={group.id}
        isOwner={isOwner}
        isOfficial={group.isOfficial}
        canEditSettings={canEditSettings}
        currentUserId={user.id}
        isPublic={group.isPublic}
        description={group.description}
        tournamentStatus={group.tournament.status}
        matchTimes={matchTimes.map((d) => d.getTime())}
        timeZone={group.tournament.timezone}
        initialMatrixRound={initialMatrixRound}
        leaderboard={leaderboard.map((row) => ({
          rank: row.rank,
          userId: row.userId,
          userName: row.userName,
          userAvatarUrl: row.userAvatarUrl,
          profit: row.profit,
        }))}
        members={group.members.map((m) => ({
          id: m.id,
          userId: m.userId,
          name: m.user.displayName ?? m.user.name,
          avatarUrl: m.user.avatarUrl,
        }))}
        settings={groupRules}
        finishedMatches={finishedMatches.map((m) => ({
          id: m.id,
          homeTeam: { name: m.homeTeam.name, logoUrl: m.homeTeam.logoUrl },
          awayTeam: { name: m.awayTeam.name, logoUrl: m.awayTeam.logoUrl },
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          scheduledAt: m.scheduledAt.toISOString(),
          round: m.round,
        }))}
        groupBets={groupBetsRaw.map((b) => ({
          matchId: b.matchId,
          userId: b.userId,
          userName: b.user.displayName ?? b.user.name,
          userAvatarUrl: b.user.avatarUrl,
          predictedHome: b.predictedHome,
          predictedAway: b.predictedAway,
          stake: b.stake,
          oddsAtBet: b.oddsAtBet,
          payout: b.payout,
          result1x2Correct: b.result1x2Correct,
          goalDiffCorrect: b.goalDiffCorrect,
          exactScoreCorrect: b.exactScoreCorrect,
        }))}
        userBadges={userBadges}
        userStats={userStats}
      />
    </div>
  );
}
