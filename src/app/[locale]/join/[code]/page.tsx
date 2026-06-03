import { getLocale, getTranslations } from "next-intl/server";
import { joinCircle } from "@/actions/circles";
import { joinGroup } from "@/actions/groups";
import { JoinSignIn } from "@/components/join-sign-in";
import { Card, CardContent } from "@/components/ui/card";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { buildJoinCallbackUrl } from "@/lib/join-url";
import { getCircleByInviteCode } from "@/queries/circles";
import { getGroupByInviteCode } from "@/queries/groups";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string; locale: string }>;
}) {
  const { code } = await params;
  const [user, locale, t] = await Promise.all([
    getCurrentUser(),
    getLocale(),
    getTranslations("join"),
  ]);

  // A kódot bejelentkezés nélkül is feloldjuk, hogy a sign-in képernyőn
  // megmutathassuk, mibe lép be a meghívott.
  const [group, circle] = await Promise.all([
    getGroupByInviteCode(code),
    getCircleByInviteCode(code),
  ]);

  // Ismeretlen kód
  if (!group && !circle) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            {t("notFound")}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Kijelentkezett meghívott: bejelentkező képernyő, ami a login után
  // visszatér ide (callbackURL), így a belépés automatikusan megtörténik.
  if (!user) {
    return (
      <JoinSignIn
        targetName={group?.name ?? circle?.name ?? ""}
        kind={group ? "group" : "circle"}
        callbackURL={buildJoinCallbackUrl(locale, code)}
      />
    );
  }

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
}
