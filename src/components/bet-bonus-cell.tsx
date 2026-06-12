"use client";

import { useTranslations } from "next-intl";
import { type BetOutcome, deriveBetBonus } from "@/lib/bet-display";

interface BetBonusCellProps {
  bet: BetOutcome;
  oddsBoost: number;
}

/**
 * Gólkülönbség / pontos eredmény bónusz cellája a lezárt tippek listáiban.
 * A bónuszt a tárolt payoutból számolja vissza; bónusz nélkül üres cella.
 */
export function BetBonusCell({ bet, oddsBoost }: BetBonusCellProps) {
  const t = useTranslations("groups");
  const bonus = deriveBetBonus(bet, oddsBoost);

  return (
    <span
      className="w-10 text-right font-mono font-semibold text-gold-text text-xs tabular-nums"
      title={
        bonus > 0 ? (bet.exactScoreCorrect ? t("bonusExactScore") : t("bonusGoalDiff")) : undefined
      }
    >
      {bonus > 0 ? `+${bonus}` : ""}
    </span>
  );
}
