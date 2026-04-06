"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { PodiumTeamList } from "@/components/podium-team-list";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMediaQuery } from "@/hooks/use-media-query";

interface TeamOption {
  id: string;
  name: string;
  logoUrl: string | null;
}

type MedalType = "gold" | "silver" | "bronze";

const medalEmojis: Record<MedalType, string> = {
  gold: "🥇",
  silver: "🥈",
  bronze: "🥉",
};

const drawerTitleKeys: Record<MedalType, string> = {
  gold: "selectGold",
  silver: "selectSilver",
  bronze: "selectBronze",
};

interface TeamPickerProps {
  medal: MedalType;
  teams: TeamOption[];
  selectedId: string;
  disabledIds: Set<string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (teamId: string) => void;
  children: ReactNode;
}

export function TeamPicker({
  medal,
  teams,
  selectedId,
  disabledIds,
  open,
  onOpenChange,
  onSelect,
  children,
}: TeamPickerProps) {
  const t = useTranslations("podium");
  const isDesktop = useMediaQuery("(min-width: 768px)");

  function handleSelect(teamId: string) {
    onSelect(teamId);
    onOpenChange(false);
  }

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="center">
          <div className="border-b px-4 py-2">
            <p className="font-semibold text-sm">
              {medalEmojis[medal]} {t(medal)}
            </p>
          </div>
          <PodiumTeamList
            teams={teams}
            selectedId={selectedId}
            disabledIds={disabledIds}
            onSelect={handleSelect}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <>
      <button type="button" onClick={() => onOpenChange(true)} className="contents">
        {children}
      </button>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>
              {medalEmojis[medal]} {t(drawerTitleKeys[medal])}
            </DrawerTitle>
          </DrawerHeader>
          <PodiumTeamList
            teams={teams}
            selectedId={selectedId}
            disabledIds={disabledIds}
            onSelect={handleSelect}
          />
        </DrawerContent>
      </Drawer>
    </>
  );
}
