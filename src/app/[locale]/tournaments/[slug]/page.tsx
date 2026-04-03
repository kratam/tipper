import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { TournamentTabs } from "@/components/tournament-tabs";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { getUserBetsForTournament } from "@/queries/bets";
import { getMatchesForTournament } from "@/queries/matches";
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

  // Serialize for client component
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
        tournamentSlug={tournament.slug}
        matches={matchesData}
        tournamentId={tournament.id}
        podiumLockDate={tournament.podiumLockDate.toISOString()}
      />
    </div>
  );
}
