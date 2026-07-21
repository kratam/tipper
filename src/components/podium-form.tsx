"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { placePodiumBet } from "@/actions/podium-bets";
import { TeamPicker } from "@/components/podium-team-picker";
import { isPlainFlag } from "@/components/team-logo";
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
  textColor: string;
  order: string;
  bgBar: string;
  label: string;
}[] = [
  {
    medal: "silver",
    emoji: "🥈",
    height: "h-[92px]",
    gradient:
      "bg-linear-to-b from-[color-mix(in_oklab,#cdd5e3_42%,var(--card))] to-[color-mix(in_oklab,#cdd5e3_18%,var(--card))]",
    border: "border-[color-mix(in_oklab,#cdd5e3_40%,transparent)]",
    textColor: "text-foreground",
    order: "order-1",
    bgBar: "bg-[#9aa6b8] text-white",
    label: "2.",
  },
  {
    medal: "gold",
    emoji: "🥇",
    height: "h-[124px]",
    gradient:
      "bg-linear-to-b from-[color-mix(in_oklab,var(--gold)_55%,var(--card))] to-[color-mix(in_oklab,var(--gold)_28%,var(--card))]",
    border: "border-gold-line",
    textColor: "text-foreground",
    order: "order-2",
    bgBar: "bg-gold-2 text-gold-ink",
    label: "1.",
  },
  {
    medal: "bronze",
    emoji: "🥉",
    height: "h-[70px]",
    gradient:
      "bg-linear-to-b from-[color-mix(in_oklab,#d98a4a_45%,var(--card))] to-[color-mix(in_oklab,#d98a4a_20%,var(--card))]",
    border: "border-[color-mix(in_oklab,#d98a4a_45%,transparent)]",
    textColor: "text-foreground",
    order: "order-3",
    bgBar: "bg-[#c47a3e] text-white",
    label: "3.",
  },
];

/**
 * Dobogós jelvény — szándékosan eltér a sima {@link TeamLogo}-tól: nagy, fehér
 * korong + árnyék + reszponzív méret. A `ring` itt is elválasztja a korong élét.
 */
export function PodiumBadge({
  team,
  size = "md",
}: {
  team: TeamOption;
  size?: "xs" | "sm" | "md";
}) {
  const sizeClass = size === "xs" ? "size-[26px]" : size === "sm" ? "size-[38px]" : "size-[46px]";
  const textSize = size === "xs" ? "text-[8px]" : size === "sm" ? "text-[10px]" : "text-xs";

  if (team.logoUrl) {
    return (
      <Image
        src={team.logoUrl}
        alt={team.name}
        width={48}
        height={48}
        className={cn(
          sizeClass,
          "rounded-full bg-white object-cover shadow-[0_3px_8px_rgba(0,0,0,0.3)]",
          isPlainFlag(team.logoUrl) && "ring-1 ring-black/10 dark:ring-white/15",
        )}
      />
    );
  }

  return (
    <span
      className={cn(
        sizeClass,
        textSize,
        "flex items-center justify-center rounded-full bg-white font-bold text-[#2a1c05] shadow-[0_3px_8px_rgba(0,0,0,0.3)]",
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
      <CardContent className="flex flex-col gap-5 px-4 py-5">
        {/* Podium */}
        <div className="mx-auto flex w-full max-w-[380px] items-end justify-center gap-2.5">
          {podiumConfig.map((cfg) => {
            const selectedTeamId = selections[cfg.medal];
            const team = teams.find((t) => t.id === selectedTeamId);
            const isEmpty = !team;

            const podiumColumn = (
              <div
                key={cfg.medal}
                className={cn("flex min-w-0 flex-1 basis-0 flex-col items-center", cfg.order)}
              >
                <div className="mb-1.5 text-lg">{cfg.emoji}</div>
                <div
                  className={cn(
                    cfg.height,
                    "grid w-full place-items-center rounded-t-xl border-[1.5px] transition-transform",
                    isEmpty
                      ? "border-border border-dashed bg-secondary"
                      : cn(cfg.gradient, cfg.border),
                    !isLocked && "cursor-pointer hover:-translate-y-[3px] active:translate-y-0",
                    isLocked && "cursor-default",
                  )}
                  role={isLocked ? undefined : "button"}
                  tabIndex={isLocked ? undefined : 0}
                >
                  {isEmpty ? (
                    <div className="text-center text-faint">
                      <div className="text-xl leading-none">+</div>
                      <div className="mt-0.5 text-[9.5px]">{t("pickTeam")}</div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 p-1.5">
                      <PodiumBadge team={team} size={cfg.medal === "gold" ? "md" : "sm"} />
                      <span
                        className={cn(
                          "max-w-20 text-center font-bold text-[10.5px] leading-tight",
                          cfg.textColor,
                        )}
                      >
                        {team.name.length > 11 ? `${team.name.slice(0, 9)}…` : team.name}
                      </span>
                    </div>
                  )}
                </div>
                {/* Position number bar */}
                <div
                  className={cn(
                    "w-full rounded-b-[7px] py-[5px] text-center font-extrabold font-mono text-[13px]",
                    cfg.bgBar,
                  )}
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
