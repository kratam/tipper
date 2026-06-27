import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { TrophyCabinet } from "@/components/trophy-cabinet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { cn } from "@/lib/utils";
import { getProfile } from "@/queries/profile";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ userId: string; locale: string }>;
}) {
  const { userId } = await params;
  const [user, locale, t] = await Promise.all([
    getCurrentUser(),
    getLocale(),
    getTranslations("profile"),
  ]);

  if (!user) {
    return redirect({ href: "/", locale });
  }

  const profile = await getProfile(userId, user.id, locale as "hu" | "en");
  if (!profile) notFound();

  const matchLabel = (m: {
    homeTeam: string;
    awayTeam: string;
    homeScore: number | null;
    awayScore: number | null;
  }) =>
    m.homeScore != null && m.awayScore != null
      ? `${m.homeTeam}–${m.awayTeam} ${m.homeScore}:${m.awayScore}`
      : `${m.homeTeam}–${m.awayTeam}`;

  const initials = profile.displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          <AvatarImage src={profile.avatarUrl ?? undefined} />
          <AvatarFallback className="text-xl">{initials}</AvatarFallback>
        </Avatar>
        <h1 className="font-bold font-heading text-2xl tracking-tight">{profile.displayName}</h1>
      </div>

      {/* Trophy cabinet */}
      <section>
        <h2 className="mb-4 font-bold font-heading text-lg">{t("trophies")}</h2>
        <TrophyCabinet earnedBadges={profile.badges} />
      </section>

      {/* Stats */}
      <section>
        <h2 className="mb-4 font-bold font-heading text-lg">{t("stats")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label={t("totalBets")} value={String(profile.stats.totalBets)} />
          <StatCard label={t("hitRate")} value={`${profile.stats.hitRate}%`} />
          <StatCard label={t("avgStake")} value={String(profile.stats.avgStake)} />
          <StatCard
            label={t("maxStake")}
            value={String(profile.stats.maxStake)}
            sub={profile.stats.maxStakeMatch ? matchLabel(profile.stats.maxStakeMatch) : undefined}
          />
          <StatCard
            label={t("biggestWin")}
            value={profile.stats.biggestWin > 0 ? `+${profile.stats.biggestWin}` : "—"}
            tone={profile.stats.biggestWin > 0 ? "win" : undefined}
            sub={
              profile.stats.biggestWinMatch ? matchLabel(profile.stats.biggestWinMatch) : undefined
            }
          />
          <StatCard
            label={t("biggestLoss")}
            value={profile.stats.biggestLoss < 0 ? String(profile.stats.biggestLoss) : "—"}
            tone={profile.stats.biggestLoss < 0 ? "loss" : undefined}
            sub={
              profile.stats.biggestLossMatch
                ? matchLabel(profile.stats.biggestLossMatch)
                : undefined
            }
          />
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone?: "win" | "loss";
  sub?: string;
}) {
  return (
    <div className="rounded-xl bg-card p-4">
      <p className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-bold text-2xl",
          tone === "win" ? "text-win" : tone === "loss" ? "text-loss" : "text-foreground",
        )}
      >
        {value}
      </p>
      {sub ? <p className="mt-1 truncate text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
