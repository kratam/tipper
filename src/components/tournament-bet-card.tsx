import { ArrowRight, CircleAlert, CircleCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { TournamentLogo } from "@/components/tournament-logo";
import { Link } from "@/i18n/navigation";
import type { UpcomingDaySummary } from "@/queries/matches";

interface TournamentBetCardProps {
  tournamentName: string;
  tournamentSlug: string;
  tournamentLogoUrl: string | null;
  days: UpcomingDaySummary[];
}

export async function TournamentBetCard({
  tournamentName,
  tournamentSlug,
  tournamentLogoUrl,
  days,
}: TournamentBetCardProps) {
  const t = await getTranslations("groups");
  const totalMissing = days.reduce((sum, d) => sum + d.missingBets, 0);

  return (
    <Link
      href={`/tournaments/${tournamentSlug}`}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/50"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {tournamentLogoUrl && (
            <TournamentLogo src={tournamentLogoUrl} alt={tournamentName} size={28} />
          )}
          <span className="font-medium">{tournamentName}</span>
        </div>
        <div className="flex items-center gap-2 font-medium text-primary text-sm">
          {t("goToBetting")}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>

      {/* Day breakdown */}
      {days.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {days.map((day) => (
            <div key={day.dateKey} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{day.label}</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-muted-foreground text-xs">
                  {t("dayMatchCount", { count: day.totalMatches })}
                </span>
                {day.missingBets > 0 ? (
                  <span className="flex items-center gap-1 font-medium text-amber-600 text-xs dark:text-amber-400">
                    <CircleAlert className="size-3.5" />
                    {t("missingBets", { count: day.missingBets })}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 font-medium text-emerald-600 text-xs dark:text-emerald-400">
                    <CircleCheck className="size-3.5" />
                    {t("allDone")}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">{t("noUpcomingMatches")}</p>
      )}

      {/* Summary footer */}
      {days.length > 0 && (
        <div className="border-border border-t pt-2">
          {totalMissing > 0 ? (
            <span className="flex items-center gap-1.5 font-medium text-amber-600 text-xs dark:text-amber-400">
              <CircleAlert className="size-3.5" />
              {t("totalMissing", { count: totalMissing })}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 font-medium text-emerald-600 text-xs dark:text-emerald-400">
              <CircleCheck className="size-3.5" />
              {t("allBetsDone")}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
