import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { JoinSignIn } from "@/components/join-sign-in";
import { Card, CardContent } from "@/components/ui/card";
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
  const user = await getCurrentUser();

  // Bejelentkezett user → a claim route idempotensen beléptet és a cél oldalra visz.
  // (A `tc_pending_invite` cookie-t a middleware már lerakta ezen a kérésen.)
  if (user) redirect("/api/join/claim");

  const [locale, t, group, circle] = await Promise.all([
    getLocale(),
    getTranslations("join"),
    getGroupByInviteCode(code),
    getCircleByInviteCode(code),
  ]);

  // Ismeretlen kód.
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

  // Kijelentkezett meghívott: bejelentkező képernyő. A login után a verifier-ág
  // (middleware) a claim route-ra terel, így a belépés automatikusan megtörténik.
  return (
    <JoinSignIn
      targetName={group?.name ?? circle?.name ?? ""}
      kind={group ? "group" : "circle"}
      callbackURL={buildJoinCallbackUrl(locale, code)}
    />
  );
}
