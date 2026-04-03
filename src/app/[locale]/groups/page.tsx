import { Plus, Users } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/user-sync";
import { getTokenBalance, getUserGroups } from "@/queries/groups";

export default async function GroupsPage() {
  const user = await getCurrentUser();
  const locale = await getLocale();

  if (!user) {
    return redirect({ href: "/", locale });
  }

  const t = await getTranslations("groups");
  const memberships = await getUserGroups(user.id);

  // Get balances for each group
  const groupsWithBalances = await Promise.all(
    memberships.map(async (gm) => {
      const balance = await getTokenBalance(user.id, gm.group.id);
      return {
        ...gm,
        balance,
      };
    }),
  );

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
            <Link key={gm.group.id} href={`/groups/${gm.group.slug}`} className="group">
              <Card className="transition-colors group-hover:ring-foreground/20">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">{gm.group.name}</CardTitle>
                  <Badge variant="outline" className="font-mono text-amber-500">
                    {gm.balance}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <p className="text-sm text-muted-foreground">{gm.group.tournament.name}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="size-3" />
                    {t("members")}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
