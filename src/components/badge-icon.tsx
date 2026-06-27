"use client";

import type { LucideIcon } from "lucide-react";
import { Award, Crown, Dice5, Flame, Gem, Medal, Sparkles, Star, Sun, Target } from "lucide-react";
import { useTranslations } from "next-intl";
import { getBadge } from "@/lib/badges/catalog";

const ICON_MAP: Record<string, LucideIcon> = {
  "dice-5": Dice5,
  target: Target,
  gem: Gem,
  sun: Sun,
  sparkles: Sparkles,
  medal: Medal,
  crown: Crown,
  award: Award,
  star: Star,
  flame: Flame,
};

const TIER_COLOR: Record<number, string> = {
  1: "text-bronze",
  2: "text-silver",
  3: "text-gold",
};

interface BadgeIconProps {
  badgeKey: string;
  tier: number;
  size?: number;
}

export function BadgeIcon({ badgeKey, tier, size = 24 }: BadgeIconProps) {
  const t = useTranslations("badges");
  const def = getBadge(badgeKey);
  if (!def) return null;

  const Icon = ICON_MAP[def.icon];
  if (!Icon) return null;

  const colorClass = TIER_COLOR[tier] ?? "text-faint";

  return (
    <Icon width={size} height={size} className={colorClass} aria-label={t(`${badgeKey}.name`)} />
  );
}
