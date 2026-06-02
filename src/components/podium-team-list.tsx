"use client";

import { TeamLogo } from "@/components/team-logo";
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
    <div className="max-h-[min(52vh,440px)] overflow-y-auto px-1 py-1">
      <div className="flex flex-col gap-[3px]">
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
                "flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors",
                isSelected && "border border-gold-line bg-gold-soft",
                isDisabled && "cursor-not-allowed opacity-40",
                !isSelected && !isDisabled && "hover:bg-surface-2",
              )}
            >
              <TeamLogo name={team.name} logoUrl={team.logoUrl} size={28} shape="round" />
              <span className={cn("flex-1 text-sm", isSelected ? "font-semibold" : "font-medium")}>
                {team.name}
              </span>
              {isSelected && <span className="text-gold text-sm">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
