import { Plus, Users } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { ArchivedGroupsSection } from "@/components/archived-groups-section";
import { GroupCard } from "@/components/group-card";
import { PublicGroupsSection } from "@/components/public-groups-section";
import { Button } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user-sync";
import {
  getMemberCountsByGroup,
  getPublicGroups,
  getUserGroups,
  getUserProfitsByGroup,
} from "@/queries/groups";

export default async function GroupsPage() {
  const user = await getCurrentUser();
  const locale = await getLocale();

  if (!user) {
    return redirect({ href: "/", locale });
  }

  const t = await getTranslations("groups");
  const memberships = await getUserGroups(user.id);
  const groupIds = memberships.map((gm) => gm.group.id);

  // Profits, member counts, and public-group suggestions are independent —
  // fetch them together. Profits and counts are single grouped aggregates
  // instead of a query per group.
  const [profits, memberCounts, allPublicGroups] = await Promise.all([
    getUserProfitsByGroup(user.id, groupIds),
    getMemberCountsByGroup(groupIds),
    getPublicGroups(user.id),
  ]);

  const groupsWithProfits = memberships.map((gm) => ({
    ...gm,
    profit: profits.get(gm.group.id) ?? 0,
    memberCount: memberCounts.get(gm.group.id) ?? 0,
  }));

  const activeGroups = groupsWithProfits.filter((gm) => !gm.group.tournament.isArchived);
  const archivedGroups = groupsWithProfits.filter((gm) => gm.group.tournament.isArchived);

  // Public groups: not finished, user not a member (archived tournaments already
  // filtered out at query level).
  const publicGroups = allPublicGroups.filter((g) => g.tournament.status !== "finished");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-bold font-heading text-2xl tracking-tight">{t("title")}</h1>
        <Button size="sm" asChild>
          <Link href="/groups/new" className="gap-2">
            <Plus className="size-4" />
            {t("create")}
          </Link>
        </Button>
      </div>

      {activeGroups.length === 0 ? (
        <p className="text-muted-foreground">{t("noGroups")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <h2 className="font-bold text-[13px] text-muted-foreground uppercase tracking-[0.08em]">
              {t("title")}
            </h2>
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
            {activeGroups.map((gm) => (
              <GroupCard
                key={gm.group.id}
                group={gm.group}
                memberCount={gm.memberCount}
                profit={gm.profit}
                variant="own"
              />
            ))}
          </div>
        </div>
      )}

      {publicGroups.length > 0 && <PublicGroupsSection groups={publicGroups} />}

      {archivedGroups.length > 0 && <ArchivedGroupsSection items={archivedGroups} />}
    </div>
  );
}
