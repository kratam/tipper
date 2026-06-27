export type BadgeMechanic = "streak" | "odds" | "count";
export type BadgeScope = "absolute" | "relative";
export type BadgeTrigger = "match" | "round" | "tournament";

export interface BadgeDef {
  key: string;
  mechanic: BadgeMechanic;
  scope: BadgeScope;
  trigger: BadgeTrigger;
  thresholds: { bronze: number; silver: number; gold: number };
  icon: string;
  minStake?: number;
}

export const BADGES: readonly BadgeDef[] = [
  {
    key: "win_streak",
    mechanic: "streak",
    scope: "absolute",
    trigger: "match",
    thresholds: { bronze: 3, silver: 5, gold: 8 },
    icon: "dice-5",
  },
  {
    key: "exact_streak",
    mechanic: "streak",
    scope: "absolute",
    trigger: "match",
    thresholds: { bronze: 2, silver: 3, gold: 4 },
    icon: "target",
  },
  {
    key: "jackpot",
    mechanic: "odds",
    scope: "absolute",
    trigger: "match",
    thresholds: { bronze: 3.0, silver: 5.0, gold: 7.0 },
    icon: "gem",
    minStake: 100,
  },
  {
    key: "perfect_day",
    mechanic: "count",
    scope: "absolute",
    trigger: "round",
    thresholds: { bronze: 1, silver: 3, gold: 7 },
    icon: "sun",
  },
  {
    key: "oracle",
    mechanic: "count",
    scope: "relative",
    trigger: "tournament",
    thresholds: { bronze: 1, silver: 3, gold: 6 },
    icon: "sparkles",
  },
  {
    key: "round_winner",
    mechanic: "count",
    scope: "relative",
    trigger: "round",
    thresholds: { bronze: 1, silver: 3, gold: 7 },
    icon: "medal",
  },
  {
    key: "champion",
    mechanic: "count",
    scope: "relative",
    trigger: "tournament",
    thresholds: { bronze: 1, silver: 3, gold: 5 },
    icon: "crown",
  },
  {
    key: "podium",
    mechanic: "count",
    scope: "relative",
    trigger: "tournament",
    thresholds: { bronze: 1, silver: 3, gold: 7 },
    icon: "award",
  },
  {
    key: "throne",
    mechanic: "count",
    scope: "relative",
    trigger: "round",
    thresholds: { bronze: 1, silver: 3, gold: 10 },
    icon: "star",
  },
  {
    key: "red_lantern",
    mechanic: "count",
    scope: "relative",
    trigger: "tournament",
    thresholds: { bronze: 1, silver: 3, gold: 5 },
    icon: "flame",
  },
];

const BY_KEY = new Map(BADGES.map((b) => [b.key, b]));
export function getBadge(key: string): BadgeDef | undefined {
  return BY_KEY.get(key);
}

export function tierFor(def: BadgeDef, value: number): 0 | 1 | 2 | 3 {
  const { bronze, silver, gold } = def.thresholds;
  if (value >= gold) return 3;
  if (value >= silver) return 2;
  if (value >= bronze) return 1;
  return 0;
}
