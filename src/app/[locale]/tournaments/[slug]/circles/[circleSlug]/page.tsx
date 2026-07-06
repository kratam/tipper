import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getLiveMatchData } from "@/actions/live";
import { CircleDetailTabs } from "@/components/circle-detail-tabs";
import { InviteCodeBadge } from "@/components/invite-code-badge";
import { TournamentLogo } from "@/components/tournament-logo";
import { Link, redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { filterAndRerankLeaderboard } from "@/lib/circle-leaderboard";
import { gravatarHash } from "@/lib/gravatar-hash";
import { liveKeys } from "@/lib/live/query-keys";
import { ensureOfficialMembership } from "@/lib/official-group";
import { getQueryClient } from "@/lib/query-client";
import { loadBadgesForUsers } from "@/queries/badges";
import { getGroupBetsForFinishedMatches } from "@/queries/bets";
import { getCircleBySlug, getOfficialGroupByTournamentId } from "@/queries/circles";
import { getGroupClassicPoints } from "@/queries/classic-points";
import { getGroupLeaderboard } from "@/queries/leaderboard";
import { getFinishedMatchesForTournament } from "@/queries/matches";
import { loadPlayerStatsForUsers } from "@/queries/profile";
import { getTipMatrixRound } from "@/queries/tip-matrix";
import { getTournamentBySlug } from "@/queries/tournaments";

export default async function CircleDetailPage({
  params,
}: {
  params: Promise<{ slug: string; circleSlug: string; locale: string }>;
}) {
  const { slug: tournamentSlug, circleSlug } = await params;
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  if (!user) return redirect({ href: "/", locale });

  const [circle, tournament] = await Promise.all([
    getCircleBySlug(circleSlug),
    getTournamentBySlug(tournamentSlug),
  ]);
  if (!circle || !tournament) notFound();

  const isMember = circle.members.some((m) => m.userId === user.id);
  if (!isMember) notFound();

  // A néző saját maga is jelenjen meg: idempotens auto-join a hivatalos csoportba.
  await ensureOfficialMembership(user.id, tournament.id, tournament.timezone);

  const official = await getOfficialGroupByTournamentId(tournament.id);

  const t = await getTranslations("circles");
  const memberIds = new Set(circle.members.map((m) => m.userId));
  const isOwner = circle.ownerId === user.id;

  const header = (
    <div className="mt-1 mb-[18px] flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        <Link
          href={`/tournaments/${tournament.slug}`}
          className="group inline-flex items-center gap-[7px] self-start rounded-md text-[11px] text-gold-text uppercase tracking-[0.12em] transition-opacity hover:opacity-75"
        >
          {tournament.logoUrl && (
            <TournamentLogo src={tournament.logoUrl} alt={tournament.name} size={16} />
          )}
          <span className="truncate font-semibold">{tournament.name}</span>
          <ChevronRight className="size-3.5 shrink-0 opacity-70 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <h1 className="mt-1 truncate font-bold font-heading text-[26px] tracking-[0.01em] max-[700px]:text-[21px]">
          {circle.name}
        </h1>
        <p className="mt-0.5 truncate font-mono text-muted-foreground text-xs">
          {t("filteredFrom")}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-1">
        <InviteCodeBadge inviteCode={circle.inviteCode} />
      </div>
    </div>
  );

  if (!official) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <p className="text-muted-foreground text-sm">{t("noData")}</p>
      </div>
    );
  }

  const circleMemberIds = circle.members.map((m) => m.userId);

  const [
    leaderboardRaw,
    finishedMatches,
    groupBetsRaw,
    initialMatrixRound,
    badgesMap,
    statsMap,
    classicByUser,
  ] = await Promise.all([
    getGroupLeaderboard(official.id),
    getFinishedMatchesForTournament(official.tournamentId, tournament.useFlagFallback),
    getGroupBetsForFinishedMatches(official.id),
    getTipMatrixRound(official.id, tournament.id, tournament.useFlagFallback, user.id, null),
    loadBadgesForUsers(circleMemberIds),
    loadPlayerStatsForUsers(circleMemberIds),
    getGroupClassicPoints(official.id),
  ]);

  const leaderboard = filterAndRerankLeaderboard(leaderboardRaw, memberIds);
  // Convert Map → plain object before crossing the server→client boundary
  const userBadges = Object.fromEntries(
    [...badgesMap.entries()].map(([uid, badges]) => [
      uid,
      badges.map((b) => ({ badgeKey: b.badgeKey, tier: b.tier })),
    ]),
  );
  const userStats = Object.fromEntries([...statsMap.entries()]);

  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: liveKeys.matches(official.tournamentId),
      queryFn: () => getLiveMatchData(official.tournamentId),
    }),
    initialMatrixRound
      ? queryClient.prefetchQuery({
          queryKey: liveKeys.tipMatrix(official.id, initialMatrixRound.roundKey),
          queryFn: async () => initialMatrixRound,
        })
      : Promise.resolve(),
  ]);

  const bets = groupBetsRaw
    .filter((b) => memberIds.has(b.userId))
    .map((b) => ({
      matchId: b.matchId,
      userId: b.userId,
      userName: b.user.displayName ?? b.user.name,
      userAvatarUrl: b.user.avatarUrl,
      gravatarHash: gravatarHash(b.user.email),
      predictedHome: b.predictedHome,
      predictedAway: b.predictedAway,
      stake: b.stake,
      oddsAtBet: b.oddsAtBet,
      payout: b.payout,
      result1x2Correct: b.result1x2Correct,
      goalDiffCorrect: b.goalDiffCorrect,
      exactScoreCorrect: b.exactScoreCorrect,
    }));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="flex flex-col gap-6">
        {header}
        <CircleDetailTabs
          circleId={circle.id}
          tournamentId={official.tournamentId}
          isOwner={isOwner}
          currentUserId={user.id}
          memberCount={circle.members.length}
          oddsBoost={official.oddsBoost}
          leaderboard={leaderboard.map((row) => ({
            ...row,
            classicPoints: classicByUser.get(row.userId) ?? 0,
          }))}
          userBadges={userBadges}
          userStats={userStats}
          finishedMatches={finishedMatches.map((m) => ({
            id: m.id,
            homeTeam: { name: m.homeTeam.name, logoUrl: m.homeTeam.logoUrl },
            awayTeam: { name: m.awayTeam.name, logoUrl: m.awayTeam.logoUrl },
            homeScore: m.homeScore,
            awayScore: m.awayScore,
            scheduledAt: m.scheduledAt.toISOString(),
            round: m.round,
          }))}
          bets={bets}
          officialGroupId={official.id}
          timeZone={tournament.timezone}
          initialMatrixRound={initialMatrixRound}
        />
      </div>
    </HydrationBoundary>
  );
}
