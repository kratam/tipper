import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { GroupDetailTabs } from "@/components/group-detail-tabs";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { getGroupBySlug } from "@/queries/groups";
import { getGroupLeaderboard } from "@/queries/leaderboard";

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

  const leaderboard = await getGroupLeaderboard(group.id);

  const isOwner = group.ownerId === user.id;
  const isMember = group.members.some((m) => m.userId === user.id);

  if (!isMember) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-2xl font-bold tracking-tight">{group.name}</h1>
          <p className="text-sm text-muted-foreground">{group.tournament.name}</p>
        </div>
      </div>

      <GroupDetailTabs
        groupId={group.id}
        inviteCode={group.inviteCode}
        isOwner={isOwner}
        currentUserId={user.id}
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
      />
    </div>
  );
}
