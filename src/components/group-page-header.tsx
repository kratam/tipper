import { ArrowRight, CircleAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { TournamentLogo } from "@/components/tournament-logo";
import { Link } from "@/i18n/navigation";
import type { UpcomingDaySummary } from "@/queries/matches";

interface GroupPageHeaderProps {
  tournamentName: string;
  tournamentSlug: string;
  tournamentLogoUrl: string | null;
  groupName: string;
  days: UpcomingDaySummary[];
}

async function MissingTipsLink({
  tournamentSlug,
  days,
}: {
  tournamentSlug: string;
  days: UpcomingDaySummary[];
}) {
  const t = await getTranslations("groups");

  const today = days[0];
  const tomorrow = days[1];
  const totalMissing = days.reduce((sum, d) => sum + d.missingBets, 0);
  const hasUrgent = (today?.missingBets ?? 0) > 0 || (tomorrow?.missingBets ?? 0) > 0;

  if (totalMissing === 0) {
    return null;
  }

  const dayParts = [today, tomorrow]
    .filter((d): d is UpcomingDaySummary => !!d && d.missingBets > 0)
    .map((d) => `${d.label}: ${d.missingBets}`);

  const colorClass = hasUrgent ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground";

  return (
    <Link
      href={`/tournaments/${tournamentSlug}`}
      className={`group inline-flex shrink-0 items-center gap-1.5 font-medium text-sm hover:underline ${colorClass}`}
    >
      <CircleAlert className="size-4" />
      <span>{t("totalMissing", { count: totalMissing })}</span>
      {dayParts.length > 0 && (
        <span className="hidden text-xs opacity-80 sm:inline">({dayParts.join(" · ")})</span>
      )}
      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export function GroupPageHeader({
  tournamentName,
  tournamentSlug,
  tournamentLogoUrl,
  groupName,
  days,
}: GroupPageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <Link
          href={`/tournaments/${tournamentSlug}`}
          className="group inline-flex items-center gap-1.5 text-muted-foreground text-xs uppercase tracking-wider hover:text-foreground"
        >
          {tournamentLogoUrl && (
            <TournamentLogo src={tournamentLogoUrl} alt={tournamentName} size={14} />
          )}
          <span className="truncate">{tournamentName}</span>
        </Link>
        <h1 className="truncate font-bold font-mono text-2xl tracking-tight">{groupName}</h1>
      </div>
      <div className="pt-2">
        <MissingTipsLink tournamentSlug={tournamentSlug} days={days} />
      </div>
    </div>
  );
}
