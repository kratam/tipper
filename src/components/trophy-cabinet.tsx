"use client";

import { useTranslations } from "next-intl";
import { BadgeIcon } from "@/components/badge-icon";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BADGES } from "@/lib/badges/catalog";
import type { StoredBadge } from "@/lib/badges/evaluate";

interface EarnedBadge extends StoredBadge {
  badgeKey: string;
}

interface TrophyCabinetProps {
  earnedBadges: EarnedBadge[];
}

export function TrophyCabinet({ earnedBadges }: TrophyCabinetProps) {
  const t = useTranslations("badges");

  const earnedMap = new Map(earnedBadges.map((b) => [b.badgeKey, b]));

  return (
    <TooltipProvider>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {BADGES.map((badgeDef) => {
          const earned = earnedMap.get(badgeDef.key);
          const tier = earned?.tier ?? 0;

          let valueLabel: string | null = null;
          if (earned && tier > 0) {
            if (badgeDef.mechanic === "odds" && earned.bestValue != null) {
              valueLabel = `${earned.bestValue.toFixed(1)}×`;
            } else {
              valueLabel = `×${earned.count}`;
            }
          }

          return (
            <Tooltip key={badgeDef.key}>
              <TooltipTrigger asChild>
                <div
                  className={`flex cursor-default flex-col items-center gap-1.5 rounded-xl p-2.5 text-center transition ${
                    tier === 0 ? "opacity-25" : "bg-card"
                  }`}
                >
                  <BadgeIcon badgeKey={badgeDef.key} tier={tier} size={32} />
                  <span className="font-medium text-[11px] text-foreground leading-tight">
                    {t(`${badgeDef.key}.name`)}
                  </span>
                  {valueLabel && (
                    <span className="text-[10px] text-muted-foreground">{valueLabel}</span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t(`${badgeDef.key}.description`)}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
