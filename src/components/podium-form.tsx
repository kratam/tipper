"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { placePodiumBet } from "@/actions/podium-bets";
import { TeamPicker } from "@/components/podium-team-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface TeamOption {
  id: string;
  name: string;
  logoUrl: string | null;
}

interface ExistingPodiumBet {
  goldTeamId: string;
  silverTeamId: string;
  bronzeTeamId: string;
}

interface PodiumFormProps {
  tournamentId: string;
  teams: TeamOption[];
  existingBet: ExistingPodiumBet | null;
  isLocked: boolean;
}

type MedalType = "gold" | "silver" | "bronze";

const podiumConfig: {
  medal: MedalType;
  emoji: string;
  height: string;
  gradient: string;
  border: string;
  borderDashed: string;
  shadow: string;
  textColor: string;
  plusColor: string;
  order: string;
  bgBar: string;
  label: string;
}[] = [
  {
    medal: "silver",
    emoji: "🥈",
    height: "h-[88px] sm:h-[95px]",
    gradient: "bg-gradient-to-b from-slate-200 to-slate-300",
    border: "border-slate-400",
    borderDashed: "border-slate-400",
    shadow: "shadow-sm",
    textColor: "text-slate-700",
    plusColor: "text-slate-400",
    order: "order-1",
    bgBar: "bg-slate-400",
    label: "2.",
  },
  {
    medal: "gold",
    emoji: "🥇",
    height: "h-[115px] sm:h-[130px]",
    gradient: "bg-gradient-to-b from-amber-100 to-amber-200",
    border: "border-amber-400",
    borderDashed: "border-amber-500",
    shadow: "shadow-md shadow-amber-200/50",
    textColor: "text-amber-800",
    plusColor: "text-amber-500",
    order: "order-2",
    bgBar: "bg-amber-400",
    label: "1.",
  },
  {
    medal: "bronze",
    emoji: "🥉",
    height: "h-[65px] sm:h-[70px]",
    gradient: "bg-gradient-to-b from-orange-200 to-orange-300",
    border: "border-orange-500",
    borderDashed: "border-orange-600",
    shadow: "shadow-sm",
    textColor: "text-orange-900",
    plusColor: "text-orange-500",
    order: "order-3",
    bgBar: "bg-orange-500",
    label: "3.",
  },
];

function TeamLogo({ team, size = "md" }: { team: TeamOption; size?: "sm" | "md" }) {
  const sizeClass = size === "sm" ? "size-8" : "size-10 sm:size-12";
  const textSize = size === "sm" ? "text-[9px]" : "text-xs";

  if (team.logoUrl) {
    return (
      <Image
        src={team.logoUrl}
        alt={team.name}
        width={48}
        height={48}
        className={cn(sizeClass, "rounded-full bg-white object-contain shadow-sm")}
      />
    );
  }

  return (
    <span
      className={cn(
        sizeClass,
        textSize,
        "flex items-center justify-center rounded-full bg-white font-bold shadow-sm",
      )}
    >
      {team.name.slice(0, 3).toUpperCase()}
    </span>
  );
}

export function PodiumForm({ tournamentId, teams, existingBet, isLocked }: PodiumFormProps) {
  const t = useTranslations("podium");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selections, setSelections] = useState<Record<MedalType, string>>({
    gold: existingBet?.goldTeamId ?? "",
    silver: existingBet?.silverTeamId ?? "",
    bronze: existingBet?.bronzeTeamId ?? "",
  });

  const [openPicker, setOpenPicker] = useState<MedalType | null>(null);

  const selectedIds = new Set(Object.values(selections).filter(Boolean));
  const allSelected = selections.gold && selections.silver && selections.bronze;

  function handleSelectTeam(medal: MedalType, teamId: string) {
    setSelections((prev) => ({ ...prev, [medal]: teamId }));
  }

  function handleSubmit() {
    if (!allSelected) return;

    startTransition(async () => {
      try {
        await placePodiumBet({
          tournamentId,
          goldTeamId: selections.gold,
          silverTeamId: selections.silver,
          bronzeTeamId: selections.bronze,
        });
        toast.success(t("submit"));
        router.refresh();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        toast.error(message);
      }
    });
  }

  if (isLocked && !existingBet) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">{t("locked")}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 px-4 py-4">
        {/* Podium */}
        <div className="mx-auto flex w-full max-w-xs items-end justify-center gap-2">
          {podiumConfig.map((cfg) => {
            const selectedTeamId = selections[cfg.medal];
            const team = teams.find((t) => t.id === selectedTeamId);
            const isEmpty = !team;

            const podiumColumn = (
              <div
                key={cfg.medal}
                className={cn("flex min-w-0 flex-1 basis-0 flex-col items-center", cfg.order)}
              >
                <div className="mb-1 text-lg sm:text-2xl">{cfg.emoji}</div>
                <div
                  className={cn(
                    cfg.height,
                    cfg.gradient,
                    "flex w-full items-center justify-center rounded-t-lg transition-all",
                    isEmpty
                      ? cn("border-2 border-dashed", cfg.borderDashed)
                      : cn("border-2", cfg.border, cfg.shadow),
                    !isLocked && "cursor-pointer hover:scale-[1.03] active:scale-[0.98]",
                    isLocked && "cursor-default",
                  )}
                  role={isLocked ? undefined : "button"}
                  tabIndex={isLocked ? undefined : 0}
                >
                  {isEmpty ? (
                    <div className="text-center">
                      <div className={cn("text-lg", cfg.plusColor)}>+</div>
                      <div className={cn("text-[9px]", cfg.plusColor)}>{t("pickTeam")}</div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <TeamLogo team={team} size={cfg.medal === "gold" ? "md" : "sm"} />
                      <span className={cn("font-bold text-[10px] sm:text-xs", cfg.textColor)}>
                        {team.name.length > 8 ? team.name.slice(0, 3).toUpperCase() : team.name}
                      </span>
                    </div>
                  )}
                </div>
                {/* Position number bar */}
                <div
                  className={cn("w-full py-1 text-center font-bold text-white text-xs", cfg.bgBar)}
                >
                  {cfg.label}
                </div>
              </div>
            );

            if (isLocked) {
              return podiumColumn;
            }

            return (
              <TeamPicker
                key={cfg.medal}
                medal={cfg.medal}
                teams={teams}
                selectedId={selectedTeamId}
                disabledIds={selectedIds}
                open={openPicker === cfg.medal}
                onOpenChange={(open) => setOpenPicker(open ? cfg.medal : null)}
                onSelect={(teamId) => handleSelectTeam(cfg.medal, teamId)}
              >
                {podiumColumn}
              </TeamPicker>
            );
          })}
        </div>

        {/* Submit button */}
        {!isLocked && (
          <Button onClick={handleSubmit} disabled={isPending || !allSelected} className="w-full">
            {t("submit")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
