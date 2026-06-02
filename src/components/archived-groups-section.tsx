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
      <CollapsibleTrigger className="group inline-flex items-center gap-2 self-start text-[13.5px] text-muted-foreground transition-colors hover:text-foreground">
        <Archive className="size-4" />
        <span>
          {t("archivedTournaments")} ({items.length})
        </span>
        <ChevronDown
          className="size-4 transition-transform group-data-[state=open]:rotate-180"
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="data-[state=closed]:hidden">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
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
