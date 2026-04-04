import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
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
      <h1 className="font-mono text-2xl font-bold tracking-tight">{t("title")}</h1>

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
                      <Image
                        src={tournament.logoUrl}
                        alt={tournament.name}
                        width={32}
                        height={32}
                        className="size-8 object-contain"
                      />
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
    </div>
  );
}
