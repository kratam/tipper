"use client";

import { Crosshair } from "lucide-react";
import { useTranslations } from "next-intl";
import { type BetOutcome, deriveBetBonus } from "@/lib/bet-display";

interface BetBonusLineProps {
  bet: BetOutcome;
  oddsBoost: number;
}

/**
 * Gólkülönbség / pontos eredmény bónusz kiírása egy lezárt tipp sora alatt.
 * A bónuszt a tárolt payoutból számolja vissza; ha nincs bónusz, nem renderel semmit.
 */
export function BetBonusLine({ bet, oddsBoost }: BetBonusLineProps) {
  const t = useTranslations("groups");
  const bonus = deriveBetBonus(bet, oddsBoost);
  if (bonus <= 0) return null;

  return (
    <div className="flex items-center justify-end gap-1 pt-0.5 font-mono text-[10px] text-gold-text">
      {bet.exactScoreCorrect && <Crosshair className="size-[10px]" />}
      <span>{bet.exactScoreCorrect ? t("bonusExactScore") : t("bonusGoalDiff")}:</span>
      <span className="font-bold tabular-nums">+{bonus}</span>
    </div>
  );
}
