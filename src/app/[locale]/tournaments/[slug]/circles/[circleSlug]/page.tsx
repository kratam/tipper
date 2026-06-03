import { Users } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CircleDetailTabs } from "@/components/circle-detail-tabs";
import { InviteCodeBadge } from "@/components/invite-code-badge";
import { TournamentLogo } from "@/components/tournament-logo";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { filterAndRerankLeaderboard } from "@/lib/circle-leaderboard";
import { ensureOfficialMembership } from "@/lib/official-group";
import { getGroupBetsForFinishedMatches } from "@/queries/bets";
import { getCircleBySlug, getOfficialGroupByTournamentId } from "@/queries/circles";
import { getGroupLeaderboard } from "@/queries/leaderboard";
import { getFinishedMatchesForTournament } from "@/queries/matches";
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
    <div className="flex flex-col gap-2">
      <div className="mt-1.5 flex items-center gap-3.5">
        {tournament.logoUrl ? (
          <span className="grid size-[42px] place-items-center rounded-xl bg-surface-2">
            <TournamentLogo src={tournament.logoUrl} alt={tournament.name} size={28} />
          </span>
        ) : (
          <span className="grid size-[42px] place-items-center rounded-xl bg-surface-2 text-muted-foreground">
            <Users className="size-5" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate font-bold font-heading text-2xl tracking-tight">{circle.name}</h1>
          <p className="truncate font-mono text-muted-foreground text-xs">
            {tournament.name} · {t("filteredFrom")}
          </p>
        </div>
      </div>
      <div className="flex justify-end">
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

  const [leaderboardRaw, finishedMatches, groupBetsRaw] = await Promise.all([
    getGroupLeaderboard(official.id),
    getFinishedMatchesForTournament(official.tournamentId, tournament.useFlagFallback),
    getGroupBetsForFinishedMatches(official.id),
  ]);

  const leaderboard = filterAndRerankLeaderboard(leaderboardRaw, memberIds);
  const bets = groupBetsRaw
    .filter((b) => memberIds.has(b.userId))
    .map((b) => ({
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
    }));

  return (
    <div className="flex flex-col gap-6">
      {header}
      <CircleDetailTabs
        circleId={circle.id}
        isOwner={isOwner}
        currentUserId={user.id}
        memberCount={circle.members.length}
        oddsBoost={official.oddsBoost}
        leaderboard={leaderboard}
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
      />
    </div>
  );
}
