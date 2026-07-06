/**
 * Egy csoport csak-olvasható "szabályai" — a groups tábla 8 konfigurálható mezője.
 * Megosztott típus a GroupRulesDialog és minden hívóhely között.
 */
export interface GroupRules {
  tokenPerMatch: number;
  initialTokens: number;
  bonusGoalDiffPct: number;
  bonusExactScorePct: number;
  bonusPodiumMention: number;
  bonusPodiumExact: number;
  oddsBoost: number;
  lossPercentage: number;
}

export interface RuleRow {
  /** next-intl kulcs a "groups" névtérben. */
  labelKey: string;
  /** Már formázott érték (pl. "200", "×1.15", "+30", "10%"). */
  value: string;
  /** Opcionális magyarázat kulcsa. */
  explainKey?: string;
  /** Az explain kulcs paraméterei. */
  explainParams?: Record<string, number>;
}

export interface RuleSection {
  /** next-intl kulcs a szekciócímhez. */
  titleKey: string;
  rows: RuleRow[];
}

/**
 * Felépíti a modalban megjelenítendő szekciókat. 0 értékű bónusz sorok kimaradnak,
 * a teljesen üres dobogó szekció szintén. A token-sorok és a visszatérítés mindig látszanak.
 */
export function buildRuleSections(rules: GroupRules): RuleSection[] {
  const oddsBoostPercent = Math.round((rules.oddsBoost - 1) * 100);
  const refundPercent = 100 - rules.lossPercentage;

  const sections: RuleSection[] = [];

  sections.push({
    titleKey: "rulesTokens",
    rows: [
      { labelKey: "initialTokens", value: String(rules.initialTokens) },
      { labelKey: "tokenPerMatch", value: String(rules.tokenPerMatch) },
    ],
  });

  const scoringRows: RuleRow[] = [
    {
      labelKey: "oddsBoost",
      value: `×${rules.oddsBoost}`,
      ...(oddsBoostPercent !== 0
        ? {
            explainKey: "oddsBoostExplain",
            explainParams: { pct: oddsBoostPercent },
          }
        : {}),
    },
  ];
  if (rules.bonusGoalDiffPct > 0) {
    scoringRows.push({ labelKey: "bonusGoalDiff", value: `${rules.bonusGoalDiffPct}%` });
  }
  if (rules.bonusExactScorePct > 0) {
    scoringRows.push({
      labelKey: "bonusExactScore",
      value: `${rules.bonusExactScorePct}%`,
    });
  }
  sections.push({ titleKey: "rulesScoring", rows: scoringRows });

  const podiumRows: RuleRow[] = [];
  if (rules.bonusPodiumMention > 0) {
    podiumRows.push({
      labelKey: "bonusPodiumMention",
      value: `+${rules.bonusPodiumMention}`,
    });
  }
  if (rules.bonusPodiumExact > 0) {
    podiumRows.push({
      labelKey: "bonusPodiumExact",
      value: `+${rules.bonusPodiumExact}`,
    });
  }
  if (podiumRows.length > 0) {
    sections.push({ titleKey: "rulesPodium", rows: podiumRows });
  }

  sections.push({
    titleKey: "rulesLoss",
    rows: [
      {
        labelKey: "refund",
        value: `${refundPercent}%`,
        ...(rules.lossPercentage >= 100
          ? { explainKey: "refundExplainFull" }
          : { explainKey: "refundExplain", explainParams: { pct: refundPercent } }),
      },
    ],
  });

  return sections;
}
