"use client";

import { Globe } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { GroupCard } from "@/components/group-card";
import { PublicGroupDialog } from "@/components/public-group-dialog";

interface PublicGroup {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  tokenPerMatch: number;
  initialTokens: number;
  bonusGoalDiff: number;
  bonusExactScore: number;
  bonusPodiumMention: number;
  oddsBoost: number;
  tournament: {
    name: string;
    slug: string;
    status: string;
  };
  members: { id: string }[];
}

interface PublicGroupsSectionProps {
  groups: PublicGroup[];
}

export function PublicGroupsSection({ groups }: PublicGroupsSectionProps) {
  const t = useTranslations("groups");
  const [selectedGroup, setSelectedGroup] = useState<PublicGroup | null>(null);

  return (
    <div>
      <div className="mb-4">
        <div className="mb-1 flex items-center gap-2">
          <Globe className="size-4.5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t("publicGroups")}</h2>
        </div>
        <p className="ml-6.5 text-sm text-muted-foreground">{t("publicGroupsSubtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            memberCount={group.members.length}
            variant="public"
            onClick={() => setSelectedGroup(group)}
          />
        ))}
      </div>

      {selectedGroup && (
        <PublicGroupDialog
          group={selectedGroup}
          memberCount={selectedGroup.members.length}
          open={!!selectedGroup}
          onOpenChange={(open) => {
            if (!open) setSelectedGroup(null);
          }}
        />
      )}
    </div>
  );
}
