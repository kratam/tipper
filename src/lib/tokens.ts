import { get1X2 } from "./scoring";

interface ProjectedBalanceInput {
  actualBalance: number;
  pendingDistributions: number;
  tokenPerMatch: number;
}

export function calculateProjectedBalance(input: ProjectedBalanceInput): number {
  return input.actualBalance + input.pendingDistributions * input.tokenPerMatch;
}

export function getRelevantOdds(
  predictedHome: number,
  predictedAway: number,
  odds: { homeOdds: string; drawOdds: string; awayOdds: string },
): number {
  const outcome = get1X2(predictedHome, predictedAway);
  switch (outcome) {
    case "1":
      return Number.parseFloat(odds.homeOdds);
    case "X":
      return Number.parseFloat(odds.drawOdds);
    case "2":
      return Number.parseFloat(odds.awayOdds);
  }
}
