import { describe, expect, it } from "vitest";
import { buildRuleSections, type GroupRules } from "@/lib/group-rules";

const base: GroupRules = {
  tokenPerMatch: 100,
  initialTokens: 200,
  bonusGoalDiff: 30,
  bonusExactScore: 50,
  bonusPodiumMention: 20,
  bonusPodiumExact: 20,
  oddsBoost: 1.15,
  lossPercentage: 90,
};

function findRow(sections: ReturnType<typeof buildRuleSections>, labelKey: string) {
  return sections.flatMap((s) => s.rows).find((r) => r.labelKey === labelKey);
}

describe("buildRuleSections", () => {
  it("formats core token and scoring rows", () => {
    const sections = buildRuleSections(base);
    expect(findRow(sections, "initialTokens")?.value).toBe("200");
    expect(findRow(sections, "tokenPerMatch")?.value).toBe("100");
    expect(findRow(sections, "oddsBoost")?.value).toBe("×1.15");
    expect(findRow(sections, "bonusGoalDiff")?.value).toBe("+30");
    expect(findRow(sections, "bonusExactScore")?.value).toBe("+50");
  });

  it("derives refund from lossPercentage (100 - loss)", () => {
    const refund = findRow(buildRuleSections(base), "refund");
    expect(refund?.value).toBe("10%");
    expect(refund?.explainKey).toBe("refundExplain");
    expect(refund?.explainParams).toEqual({ pct: 10 });
  });

  it("uses full-loss explanation when lossPercentage is 100", () => {
    const refund = findRow(buildRuleSections({ ...base, lossPercentage: 100 }), "refund");
    expect(refund?.value).toBe("0%");
    expect(refund?.explainKey).toBe("refundExplainFull");
    expect(refund?.explainParams).toBeUndefined();
  });

  it("adds odds explanation only when boost is above 1", () => {
    const withBoost = findRow(buildRuleSections(base), "oddsBoost");
    expect(withBoost?.explainKey).toBe("oddsBoostExplain");
    expect(withBoost?.explainParams).toEqual({ pct: 15 });

    const noBoost = findRow(buildRuleSections({ ...base, oddsBoost: 1 }), "oddsBoost");
    expect(noBoost?.value).toBe("×1");
    expect(noBoost?.explainKey).toBeUndefined();
  });

  it("hides the podium section when both podium bonuses are 0", () => {
    const sections = buildRuleSections({
      ...base,
      bonusPodiumMention: 0,
      bonusPodiumExact: 0,
    });
    expect(sections.find((s) => s.titleKey === "rulesPodium")).toBeUndefined();
  });

  it("hides individual zero-value bonus rows", () => {
    const sections = buildRuleSections({ ...base, bonusGoalDiff: 0 });
    expect(findRow(sections, "bonusGoalDiff")).toBeUndefined();
    expect(findRow(sections, "bonusExactScore")?.value).toBe("+50");
  });
});
