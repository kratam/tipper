import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { TrophyCabinet } from "@/components/trophy-cabinet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user-sync";
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

  const profile = await getProfile(userId, user.id);
  if (!profile) notFound();

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
          <StatCard label={t("hitRate")} value={`${Math.round(profile.stats.hitRate * 100)}%`} />
          <StatCard label={t("bestStreak")} value={String(profile.stats.bestWinStreak)} />
          {profile.stats.biggestJackpotOdds != null && (
            <StatCard
              label={t("biggestJackpot")}
              value={`${profile.stats.biggestJackpotOdds.toFixed(1)}×`}
            />
          )}
          <StatCard label={t("champion")} value={String(profile.stats.placements.champion)} />
          <StatCard label={t("podium")} value={String(profile.stats.placements.podium)} />
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card p-4">
      <p className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className="mt-1 font-bold text-2xl text-foreground">{value}</p>
    </div>
  );
}
