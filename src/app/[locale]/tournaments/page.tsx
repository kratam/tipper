import { ChevronRight, Crown, Trophy } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { TournamentLogo } from "@/components/tournament-logo";
import { TournamentStatusBadge } from "@/components/tournament-status-badge";
import { Link, redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { cn } from "@/lib/utils";
import { getTournaments } from "@/queries/tournaments";

function statusOrder(status: string): number {
  if (status === "active") return 0;
  if (status === "upcoming") return 1;
  return 2;
}

interface TourRowProps {
  name: string;
  status: string;
  logoUrl: string | null;
  active: boolean;
}

function TourRowInner({ name, status, logoUrl, active }: TourRowProps) {
  return (
    <>
      <span
        className={cn(
          "grid size-[46px] flex-none place-items-center rounded-xl",
          active
            ? "bg-linear-to-br from-gold to-gold-2 text-gold-ink"
            : "border border-border bg-secondary text-muted-foreground",
        )}
      >
        {logoUrl ? (
          <TournamentLogo src={logoUrl} alt={name} size={26} />
        ) : (
          <Trophy className="size-[22px]" strokeWidth={1.6} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-bold text-[16px]">{name}</div>
      </div>
      <div className="flex flex-none flex-col items-end gap-1">
        <TournamentStatusBadge status={status} />
        <ChevronRight className="size-4 text-faint" />
      </div>
    </>
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

  const rowBase =
    "flex w-full items-center gap-3.5 rounded-lg border border-border bg-card p-[15px] text-left shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_12px_28px_-22px_rgba(0,0,0,0.9)]";

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center gap-3.5">
        <span className="grid size-[46px] place-items-center rounded-xl bg-linear-to-br from-gold to-gold-2 text-gold-ink shadow-[0_8px_20px_-8px_var(--gold-2)]">
          <Crown className="size-6" strokeWidth={1.6} />
        </span>
        <h1 className="font-bold font-heading text-[27px] tracking-tight max-[700px]:text-[22px]">
          {t("title")}
        </h1>
      </div>

      {sorted.length === 0 ? (
        <p className="text-muted-foreground">{t("noTournaments")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((tournament) => {
            const active = tournament.status === "active";
            return (
              <Link
                key={tournament.id}
                href={`/tournaments/${tournament.slug}`}
                className={cn(
                  rowBase,
                  "transition hover:-translate-y-0.5 hover:border-gold-line",
                  !active && "opacity-70 hover:opacity-100",
                )}
              >
                <TourRowInner
                  name={tournament.name}
                  status={tournament.status}
                  logoUrl={tournament.logoUrl}
                  active={active}
                />
              </Link>
            );
          })}
        </div>
      )}

      <div className="rounded-lg border border-border bg-secondary p-4">
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
            <p className="font-medium text-sm">{t("howToPlayOdds")}</p>
            <p className="text-muted-foreground text-sm">{t("howToPlayOddsDesc")}</p>
          </div>
          <div>
            <p className="font-medium text-sm">{t("howToPlayLockedOdds")}</p>
            <p className="text-muted-foreground text-sm">{t("howToPlayLockedOddsDesc")}</p>
          </div>
          <div>
            <p className="font-medium text-sm">{t("howToPlayScoring")}</p>
            <p className="text-muted-foreground text-sm">{t("howToPlayScoringDesc")}</p>
          </div>
          <div>
            <p className="font-medium text-sm">{t("howToPlayPodium")}</p>
            <p className="text-muted-foreground text-sm">{t("howToPlayPodiumDesc")}</p>
          </div>
          <div>
            <p className="font-medium text-sm">{t("howToPlayLeaderboard")}</p>
            <p className="text-muted-foreground text-sm">{t("howToPlayLeaderboardDesc")}</p>
          </div>
          <div>
            <p className="font-medium text-sm">{t("howToPlayGroups")}</p>
            <p className="text-muted-foreground text-sm">{t("howToPlayGroupsDesc")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
