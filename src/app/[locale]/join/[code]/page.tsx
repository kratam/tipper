import { getLocale, getTranslations } from "next-intl/server";
import { joinGroup } from "@/actions/groups";
import { Card, CardContent } from "@/components/ui/card";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { getGroupByInviteCode } from "@/queries/groups";

export default async function JoinGroupPage({
  params,
}: {
  params: Promise<{ code: string; locale: string }>;
}) {
  const { code } = await params;
  const user = await getCurrentUser();
  const locale = await getLocale();

  if (!user) {
    return redirect({ href: "/", locale });
  }

  const t = await getTranslations("join");

  const group = await getGroupByInviteCode(code);
  if (!group) {
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

  // Attempt to join — the action will redirect on success
  try {
    await joinGroup(code);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : t("error");
    // If already a member, the error might be "Already a member" — redirect to group
    if (message.includes("Already a member")) {
      redirect({ href: `/groups/${group.slug}`, locale });
    }

    return (
      <div className="flex flex-1 items-center justify-center">
        <Card>
          <CardContent className="p-6 text-center text-destructive">{message}</CardContent>
        </Card>
      </div>
    );
  }

  // If we get here somehow, redirect to the group
  redirect({ href: `/groups/${group.slug}`, locale });
}
