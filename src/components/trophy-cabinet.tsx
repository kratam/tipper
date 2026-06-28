"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
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

/**
 * Egy jelvény-cella a trófea szekrényben. Controlled `open` + onClick toggle —
 * mert touch-eszközön nincs hover, így mobilon kattintásra is megjelenik a
 * leírás (lásd tip-matrix PlayerAvatarTooltip ugyanezzel a mintával).
 */
function BadgeCell({
  name,
  description,
  badgeKey,
  tier,
  valueLabel,
}: {
  name: string;
  description: string;
  badgeKey: string;
  tier: number;
  valueLabel: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setOpen((v) => !v);
          }}
          aria-label={name}
          className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl p-2.5 text-center transition ${
            tier === 0 ? "opacity-25" : "bg-card"
          }`}
        >
          <BadgeIcon badgeKey={badgeKey} tier={tier} size={32} />
          <span className="font-medium text-[11px] text-foreground leading-tight">{name}</span>
          {valueLabel && <span className="text-[10px] text-muted-foreground">{valueLabel}</span>}
        </button>
      </TooltipTrigger>
      <TooltipContent collisionPadding={12} className="max-w-[220px] text-center">
        <p>{description}</p>
      </TooltipContent>
    </Tooltip>
  );
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
            <BadgeCell
              key={badgeDef.key}
              badgeKey={badgeDef.key}
              tier={tier}
              name={t(`${badgeDef.key}.name`)}
              description={t(`${badgeDef.key}.description`)}
              valueLabel={valueLabel}
            />
          );
        })}
      </div>
    </TooltipProvider>
  );
}
