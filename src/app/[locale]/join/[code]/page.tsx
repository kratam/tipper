import { getLocale, getTranslations } from "next-intl/server";
import { joinCircle } from "@/actions/circles";
import { joinGroup } from "@/actions/groups";
import { Card, CardContent } from "@/components/ui/card";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { getCircleByInviteCode } from "@/queries/circles";
import { getGroupByInviteCode } from "@/queries/groups";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string; locale: string }>;
}) {
  const { code } = await params;
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  if (!user) return redirect({ href: "/", locale });

  const t = await getTranslations("join");

  const group = await getGroupByInviteCode(code);

  // 1) Csoport-kód
  if (group) {
    try {
      await joinGroup(code);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("error");
      if (message.includes("Already a member")) {
        redirect({ href: `/tournaments/${group.tournament.slug}/groups/${group.slug}`, locale });
      }
      return (
        <div className="flex flex-1 items-center justify-center">
          <Card>
            <CardContent className="p-6 text-center text-destructive">{message}</CardContent>
          </Card>
        </div>
      );
    }
    redirect({ href: `/tournaments/${group.tournament.slug}/groups/${group.slug}`, locale });
  }

  // 2) Kör-kód
  const circle = await getCircleByInviteCode(code);
  if (circle) {
    try {
      await joinCircle(code);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("error");
      // Már tag → irány a köreim
      if (!message.includes("Already a member")) {
        return (
          <div className="flex flex-1 items-center justify-center">
            <Card>
              <CardContent className="p-6 text-center text-destructive">{message}</CardContent>
            </Card>
          </div>
        );
      }
    }
    redirect({ href: "/circles", locale });
  }

  // 3) Egyik sem
  return (
    <div className="flex flex-1 items-center justify-center">
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">{t("notFound")}</CardContent>
      </Card>
    </div>
  );
}
