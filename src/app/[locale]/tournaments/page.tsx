import { getLocale, getTranslations } from "next-intl/server";
import { TournamentLogo } from "@/components/tournament-logo";
import { TournamentStatusBadge } from "@/components/tournament-status-badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { getTournaments } from "@/queries/tournaments";

function statusOrder(status: string): number {
  if (status === "active") return 0;
  if (status === "upcoming") return 1;
  return 2;
}

export default async function TournamentsPage() {
  const user = await getCurrentUser();
  const locale = await getLocale();

  if (!user) {
    return redirect({ href: "/", locale });
  }

  const t = await getTranslations("tournaments");
  const tournaments = await getTournaments();

  const sorted = [...tournaments].sort((a, b) => statusOrder(a.status) - statusOrder(b.status));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-bold font-mono text-2xl tracking-tight">{t("title")}</h1>

      {sorted.length === 0 ? (
        <p className="text-muted-foreground">{t("noTournaments")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((tournament) => (
            <Link key={tournament.id} href={`/tournaments/${tournament.slug}`} className="group">
              <Card className="transition-colors group-hover:ring-foreground/20">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    {tournament.logoUrl && (
                      <TournamentLogo src={tournament.logoUrl} alt={tournament.name} size={32} />
                    )}
                    <CardTitle className="text-base">{tournament.name}</CardTitle>
                  </div>
                  <TournamentStatusBadge status={tournament.status} />
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="rounded-lg border bg-muted/30 p-4">
        <h2 className="mb-3 font-semibold">{t("howToPlay")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="font-medium text-sm">{t("howToPlayTokens")}</p>
            <p className="text-muted-foreground text-sm">{t("howToPlayTokensDesc")}</p>
          </div>
          <div>
            <p className="font-medium text-sm">{t("howToPlayBetting")}</p>
            <p className="text-muted-foreground text-sm">{t("howToPlayBettingDesc")}</p>
          </div>
          <div>
            <p className="font-medium text-sm">{t("howToPlayScoring")}</p>
            <p className="text-muted-foreground text-sm">{t("howToPlayScoringDesc")}</p>
          </div>
          <div>
            <p className="font-medium text-sm">{t("howToPlayPodium")}</p>
            <p className="text-muted-foreground text-sm">{t("howToPlayPodiumDesc")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
