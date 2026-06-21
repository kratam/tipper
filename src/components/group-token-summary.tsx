"use client";

import { Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { GroupCard } from "@/components/group-card";
import { PublicGroupDialog } from "@/components/public-group-dialog";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { PublicGroupSuggestion } from "@/queries/groups";

interface GroupTokenSummaryProps {
  topPublicGroups?: PublicGroupSuggestion[];
  hasOfficialGroup?: boolean;
}

/**
 * Empty-state for the groups section: shown when the user has no joined groups.
 * When groups exist, the torna-landing board-paneljéhez (TournamentBoardPanel) renders them.
 */
export function GroupTokenSummary({
  topPublicGroups = [],
  hasOfficialGroup = false,
}: GroupTokenSummaryProps) {
  const t = useTranslations("tournaments");
  const [selectedGroup, setSelectedGroup] = useState<PublicGroupSuggestion | null>(null);

  // Suppressed for now per request — show only the public-group suggestions block
  // when there are recommendations. The "Csoport létrehozása" prompt is omitted and
  // can be restored when we want to nudge users toward creating their own group again.
  if (!topPublicGroups || topPublicGroups.length === 0) {
    return null;
  }

  const emptyHeadline = hasOfficialGroup ? t("joinAnotherGroup") : t("noGroupYet");

  return (
    <>
      <div className="rounded-lg border border-border border-dashed bg-muted/30 p-4">
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">{emptyHeadline}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {topPublicGroups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                memberCount={group.memberCount}
                variant="public"
                onClick={() => setSelectedGroup(group)}
              />
            ))}
          </div>
          <Button variant="outline" size="sm" asChild className="gap-2 self-start">
            <Link href="/groups">
              <Users className="size-4" />
              {t("browseGroups")}
            </Link>
          </Button>
        </div>
      </div>

      {selectedGroup && (
        <PublicGroupDialog
          group={selectedGroup}
          memberCount={selectedGroup.memberCount}
          open={!!selectedGroup}
          onOpenChange={(open) => {
            if (!open) setSelectedGroup(null);
          }}
        />
      )}
    </>
  );
}
