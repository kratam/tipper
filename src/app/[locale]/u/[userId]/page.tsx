import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { EditDisplayNameButton } from "@/components/edit-display-name-button";
import { TeamLogo } from "@/components/team-logo";
import { TrophyCabinet } from "@/components/trophy-cabinet";
import { UserAvatar } from "@/components/user-avatar";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { cn } from "@/lib/utils";
import { getProfile, type StatMatch } from "@/queries/profile";

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

  const { stats } = profile;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <UserAvatar
          name={profile.displayName}
          googleAvatarUrl={profile.avatarUrl}
          gravatarHash={profile.gravatarHash}
          sizePx={128}
          className="size-16"
          fallbackClassName="text-xl"
        />
        <h1 className="font-bold font-heading text-2xl tracking-tight">{profile.displayName}</h1>
        {user.id === userId && <EditDisplayNameButton currentDisplayName={user.displayName} />}
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
          <StatCard label={t("totalBets")} value={String(stats.totalBets)} />
          <StatCard label={t("hitRate")} value={`${stats.hitRate}%`} />
          <StatCard label={t("avgStake")} value={String(stats.avgStake)} />
          <StatCard
            label={t("maxStake")}
            value={String(stats.maxStake)}
            footer={stats.maxStakeMatch ? <StatMatchRow m={stats.maxStakeMatch} /> : undefined}
          />
          <StatCard
            label={t("biggestWin")}
            value={stats.biggestWin > 0 ? `+${stats.biggestWin}` : "—"}
            tone={stats.biggestWin > 0 ? "win" : undefined}
            footer={stats.biggestWinMatch ? <StatMatchRow m={stats.biggestWinMatch} /> : undefined}
          />
          <StatCard
            label={t("biggestLoss")}
            value={stats.biggestLoss < 0 ? String(stats.biggestLoss) : "—"}
            tone={stats.biggestLoss < 0 ? "loss" : undefined}
            footer={
              stats.biggestLossMatch ? <StatMatchRow m={stats.biggestLossMatch} /> : undefined
            }
          />
        </div>
      </section>
    </div>
  );
}

/** A stathoz tartozó meccs kompakt jelzése: [zászló] eredmény [zászló] —
 * a Results-fül eredmény-mintáját követi (TeamLogo + font-mono tabular-nums). */
function StatMatchRow({ m }: { m: StatMatch }) {
  const score = m.homeScore != null && m.awayScore != null ? `${m.homeScore}-${m.awayScore}` : "–";
  return (
    <div className="mt-2 flex items-center justify-center gap-2">
      <TeamLogo name={m.home.name} logoUrl={m.home.logoUrl} size={18} />
      <span className="font-bold font-mono text-[14px] text-foreground tabular-nums">{score}</span>
      <TeamLogo name={m.away.name} logoUrl={m.away.logoUrl} size={18} />
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  footer,
}: {
  label: string;
  value: string;
  tone?: "win" | "loss";
  footer?: ReactNode;
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
      {footer}
    </div>
  );
}
