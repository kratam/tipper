import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { GroupDetailTabs } from "@/components/group-detail-tabs";
import { InviteCodeBadge } from "@/components/invite-code-badge";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { getGroupBetsForFinishedMatches } from "@/queries/bets";
import { getGroupBySlug } from "@/queries/groups";
import { getGroupLeaderboard } from "@/queries/leaderboard";
import { getFinishedMatchesForTournament } from "@/queries/matches";

export default async function GroupDetailPage({
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

  const group = await getGroupBySlug(slug);
  if (!group) notFound();

  const [leaderboard, finishedMatches, groupBetsRaw] = await Promise.all([
    getGroupLeaderboard(group.id),
    getFinishedMatchesForTournament(group.tournamentId),
    getGroupBetsForFinishedMatches(group.id),
  ]);

  const isOwner = group.ownerId === user.id;
  const isMember = group.members.some((m) => m.userId === user.id);

  if (!isMember) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-mono text-2xl font-bold tracking-tight">{group.name}</h1>
          <InviteCodeBadge inviteCode={group.inviteCode} />
        </div>
        <p className="text-sm text-muted-foreground">{group.tournament.name}</p>
      </div>

      <GroupDetailTabs
        groupId={group.id}
        isOwner={isOwner}
        currentUserId={user.id}
        isPublic={group.isPublic}
        description={group.description}
        tournamentStatus={group.tournament.status}
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
        settings={{
          tokenPerMatch: group.tokenPerMatch,
          initialTokens: group.initialTokens,
          distributionDaysBefore: group.distributionDaysBefore,
          bonusGoalDiff: group.bonusGoalDiff,
          bonusExactScore: group.bonusExactScore,
          bonusPodiumMention: group.bonusPodiumMention,
          bonusPodiumExact: group.bonusPodiumExact,
          oddsBoost: group.oddsBoost,
        }}
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
          payout: b.payout,
          result1x2Correct: b.result1x2Correct,
          goalDiffCorrect: b.goalDiffCorrect,
          exactScoreCorrect: b.exactScoreCorrect,
        }))}
      />
    </div>
  );
}
