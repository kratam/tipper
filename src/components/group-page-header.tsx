import { ArrowRight, ChevronRight, CircleAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { GroupRulesDialog } from "@/components/group-rules-dialog";
import { TournamentLogo } from "@/components/tournament-logo";
import { Link } from "@/i18n/navigation";
import type { GroupRules } from "@/lib/group-rules";
import type { UpcomingDaySummary } from "@/queries/matches";

interface GroupPageHeaderProps {
  tournamentName: string;
  tournamentSlug: string;
  tournamentLogoUrl: string | null;
  groupName: string;
  rules: GroupRules;
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

  const colorClass = hasUrgent ? "text-gold" : "text-muted-foreground";

  return (
    <Link
      href={`/tournaments/${tournamentSlug}`}
      className={`group inline-flex shrink-0 items-center gap-1.5 font-semibold text-[12.5px] hover:underline ${colorClass}`}
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
  rules,
  days,
}: GroupPageHeaderProps) {
  return (
    <div className="mt-1 mb-[18px] flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        <Link
          href={`/tournaments/${tournamentSlug}`}
          className="group inline-flex items-center gap-[7px] self-start rounded-md text-[11px] text-gold/80 uppercase tracking-[0.12em] transition-colors hover:text-gold"
        >
          {tournamentLogoUrl && (
            <TournamentLogo src={tournamentLogoUrl} alt={tournamentName} size={16} />
          )}
          <span className="truncate font-semibold">{tournamentName}</span>
          <ChevronRight className="size-3.5 shrink-0 opacity-70 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <h1 className="mt-1 truncate font-bold font-heading text-[26px] tracking-[0.01em] max-[700px]:text-[21px]">
          {groupName}
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-1">
        <MissingTipsLink tournamentSlug={tournamentSlug} days={days} />
        <GroupRulesDialog groupName={groupName} rules={rules} iconOnly />
      </div>
    </div>
  );
}
