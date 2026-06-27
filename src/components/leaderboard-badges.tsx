"use client";

import { BadgeIcon } from "@/components/badge-icon";
import { BADGES } from "@/lib/badges/catalog";

interface BadgeEntry {
  badgeKey: string;
  tier: number;
}

interface LeaderboardBadgesProps {
  badges: BadgeEntry[];
}

const CATALOG_ORDER = new Map(BADGES.map((b, i) => [b.key, i]));

export function LeaderboardBadges({ badges }: LeaderboardBadgesProps) {
  const earned = badges.filter((b) => b.tier >= 1);
  if (earned.length === 0) return null;

  const top3 = [...earned]
    .sort((a, b) => {
      if (b.tier !== a.tier) return b.tier - a.tier;
      return (CATALOG_ORDER.get(a.badgeKey) ?? 999) - (CATALOG_ORDER.get(b.badgeKey) ?? 999);
    })
    .slice(0, 3);

  return (
    <span className="flex shrink-0 items-center gap-0.5">
      {top3.map((badge) => (
        <BadgeIcon key={badge.badgeKey} badgeKey={badge.badgeKey} tier={badge.tier} size={16} />
      ))}
    </span>
  );
}
