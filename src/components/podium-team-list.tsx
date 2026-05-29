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
                isSelected && "border-primary border-l-3 bg-primary/10",
                isDisabled && "cursor-not-allowed opacity-40",
                !isSelected && !isDisabled && "hover:bg-muted",
              )}
            >
              <TeamLogo name={team.name} logoUrl={team.logoUrl} size={28} shape="round" />
              <span className={cn("flex-1 text-sm", isSelected && "font-semibold")}>
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
