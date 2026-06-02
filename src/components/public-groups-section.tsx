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
  lossPercentage: number;
  tournament: {
    name: string;
    slug: string;
    status: string;
  };
  memberCount: number;
}

interface PublicGroupsSectionProps {
  groups: PublicGroup[];
}

export function PublicGroupsSection({ groups }: PublicGroupsSectionProps) {
  const t = useTranslations("groups");
  const [selectedGroup, setSelectedGroup] = useState<PublicGroup | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Globe className="size-4 text-muted-foreground" />
        <h2 className="font-bold text-[13px] text-muted-foreground uppercase tracking-[0.08em]">
          {t("publicGroups")}
        </h2>
        <span className="h-px flex-1 bg-border" />
      </div>
      <p className="-mt-1 text-muted-foreground text-sm">{t("publicGroupsSubtitle")}</p>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
        {groups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            memberCount={group.memberCount}
            variant="public"
            onClick={() => setSelectedGroup(group)}
          />
        ))}
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
    </div>
  );
}
