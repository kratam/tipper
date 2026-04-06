import { getLocale, getTranslations } from "next-intl/server";
import { AdminPanel } from "@/components/admin-panel";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { getTournamentTeams } from "@/queries/podium";
import { getTournaments } from "@/queries/tournaments";

export default async function AdminPage() {
  const user = await getCurrentUser();
  const locale = await getLocale();

  if (!user) {
    return redirect({ href: "/", locale });
  }

  if (!user.isAdmin) {
    return redirect({ href: "/tournaments", locale });
  }

  const t = await getTranslations("admin");
  const tournaments = await getTournaments();

  const tournamentsWithTeams = await Promise.all(
    tournaments.map(async (tour) => ({
      id: tour.id,
      name: tour.name,
      slug: tour.slug,
      status: tour.status,
      apiLeagueId: tour.apiLeagueId,
      apiSeason: tour.apiSeason,
      logoUrl: tour.logoUrl,
      timezone: tour.timezone,
      podiumLockDate: tour.podiumLockDate,
      teams: await getTournamentTeams(tour.id),
    })),
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-mono text-2xl font-bold tracking-tight">{t("title")}</h1>
      <AdminPanel tournaments={tournamentsWithTeams} />
    </div>
  );
}
