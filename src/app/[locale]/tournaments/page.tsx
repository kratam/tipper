import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { getTournaments } from "@/queries/tournaments";

function statusOrder(status: string): number {
  if (status === "active") return 0;
  if (status === "upcoming") return 1;
  return 2;
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-500",
    upcoming: "bg-amber-500/10 text-amber-500",
    finished: "bg-muted text-muted-foreground",
  };

  return (
    <Badge variant="outline" className={colorMap[status] ?? ""}>
      {status}
    </Badge>
  );
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
                  <CardTitle className="text-base">{tournament.name}</CardTitle>
                  <StatusBadge status={tournament.status} />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {tournament.status === "active"
                      ? t("active")
                      : tournament.status === "upcoming"
                        ? t("upcoming")
                        : t("finished")}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
