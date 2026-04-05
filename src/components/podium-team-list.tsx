"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface TeamOption {
  id: string;
  name: string;
  logoUrl: string | null;
}

interface PodiumTeamListProps {
  teams: TeamOption[];
  selectedId: string;
  disabledIds: Set<string>;
  onSelect: (teamId: string) => void;
}

export function PodiumTeamList({ teams, selectedId, disabledIds, onSelect }: PodiumTeamListProps) {
  return (
    <div className="max-h-75 overflow-y-auto">
      <div className="flex flex-col">
        {teams.map((team) => {
          const isSelected = team.id === selectedId;
          const isDisabled = disabledIds.has(team.id) && !isSelected;

          return (
            <button
              key={team.id}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelect(team.id)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 text-left transition-colors",
                isSelected && "bg-primary/10 border-l-3 border-primary",
                isDisabled && "opacity-40 cursor-not-allowed",
                !isSelected && !isDisabled && "hover:bg-muted",
              )}
            >
              {team.logoUrl ? (
                <Image
                  src={team.logoUrl}
                  alt={team.name}
                  width={28}
                  height={28}
                  className="size-7 rounded-full object-contain"
                />
              ) : (
                <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-bold">
                  {team.name.slice(0, 3).toUpperCase()}
                </span>
              )}
              <span className={cn("text-sm flex-1", isSelected && "font-semibold")}>
                {team.name}
              </span>
              {isSelected && <span className="text-primary text-sm">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
