import { Plus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { CirclesList } from "@/components/circles-list";
import { GroupVsCircleNote } from "@/components/group-vs-circle-note";
import { Button } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { pickGoogleAvatarUrl } from "@/lib/avatar-detect";
import { gravatarHash } from "@/lib/gravatar-hash";
import { getUserCircles } from "@/queries/circles";

export default async function CirclesPage() {
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  if (!user) return redirect({ href: "/", locale });

  const t = await getTranslations("circles");
  const circles = await getUserCircles(user.id);

  const items = circles.map((circle) => ({
    id: circle.id,
    name: circle.name,
    inviteCode: circle.inviteCode,
    isOwner: circle.ownerId === user.id,
    members: circle.members.map((m) => ({
      userId: m.userId,
      name: m.user.displayName ?? m.user.name,
      avatarUrl: pickGoogleAvatarUrl(m.user.avatarUrl, m.user.avatarIsReal),
      gravatarHash: gravatarHash(m.user.email),
    })),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-bold font-heading text-2xl tracking-tight">{t("title")}</h1>
        <Button size="sm" asChild>
          <Link href="/circles/new" className="gap-2">
            <Plus className="size-4" />
            {t("create")}
          </Link>
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">{t("subtitle")}</p>

      <GroupVsCircleNote />

      {items.length === 0 ? (
        <p className="rounded-lg border border-border border-dashed bg-muted/30 p-4 text-muted-foreground text-sm">
          {t("empty")}
        </p>
      ) : (
        <CirclesList circles={items} />
      )}
    </div>
  );
}
