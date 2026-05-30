"use client";

import { Archive, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { GroupCard } from "@/components/group-card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ArchivedGroupItem {
  group: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    tournament: {
      name: string;
      slug: string;
      status: string;
    };
  };
  memberCount: number;
  profit: number;
}

interface ArchivedGroupsSectionProps {
  items: ArchivedGroupItem[];
}

export function ArchivedGroupsSection({ items }: ArchivedGroupsSectionProps) {
  const t = useTranslations("groups");
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col gap-3">
      <CollapsibleTrigger className="group flex items-center gap-2 text-left text-muted-foreground text-sm transition-colors hover:text-foreground">
        <Archive className="size-4" />
        <span>
          {t("archivedTournaments")} ({items.length})
        </span>
        <ChevronDown
          className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="data-[state=closed]:hidden">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <GroupCard
              key={item.group.id}
              group={item.group}
              memberCount={item.memberCount}
              profit={item.profit}
              variant="own"
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
