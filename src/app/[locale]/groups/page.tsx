import { Plus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { GroupCard } from "@/components/group-card";
import { PublicGroupsSection } from "@/components/public-groups-section";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link, redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { getPublicGroups, getTokenBalance, getUserGroups } from "@/queries/groups";

export default async function GroupsPage() {
  const user = await getCurrentUser();
  const locale = await getLocale();

  if (!user) {
    return redirect({ href: "/", locale });
  }

  const t = await getTranslations("groups");
  const memberships = await getUserGroups(user.id);

  const groupsWithBalances = await Promise.all(
    memberships.map(async (gm) => {
      const balance = await getTokenBalance(user.id, gm.group.id);
      return { ...gm, balance };
    }),
  );

  // Public groups: not finished, user not a member
  const allPublicGroups = await getPublicGroups(user.id);
  const publicGroups = allPublicGroups.filter((g) => g.tournament.status !== "finished");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-mono text-2xl font-bold tracking-tight">{t("title")}</h1>
        <Button size="sm" asChild>
          <Link href="/groups/new" className="gap-2">
            <Plus className="size-4" />
            {t("create")}
          </Link>
        </Button>
      </div>

      {groupsWithBalances.length === 0 ? (
        <p className="text-muted-foreground">{t("noGroups")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groupsWithBalances.map((gm) => (
            <GroupCard
              key={gm.group.id}
              group={gm.group}
              memberCount={gm.group.members?.length ?? 0}
              balance={gm.balance}
              variant="own"
            />
          ))}
        </div>
      )}

      {publicGroups.length > 0 && (
        <>
          <Separator />
          <PublicGroupsSection groups={publicGroups} />
        </>
      )}
    </div>
  );
}
