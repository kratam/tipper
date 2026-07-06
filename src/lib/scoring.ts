type Outcome = "1" | "X" | "2";

export function get1X2(home: number, away: number): Outcome {
  if (home > away) return "1";
  if (home === away) return "X";
  return "2";
}

interface BetPayoutInput {
  predictedHome: number;
  predictedAway: number;
  actualHome: number;
  actualAway: number;
  stake: number;
  oddsAtBet: number | null;
  groupSettings: {
    bonusGoalDiff: number;
    bonusExactScore: number;
    oddsBoost: number;
    lossPercentage: number;
  };
}

interface BetPayoutResult {
  payout: number;
  result1x2Correct: boolean;
  goalDiffCorrect: boolean;
  exactScoreCorrect: boolean;
}

function partialRefund(stake: number, lossPercentage: number): number {
  const clamped = Math.max(0, Math.min(100, lossPercentage));
  return Math.round((stake * (100 - clamped)) / 100);
}

export function calculateBetPayout(input: BetPayoutInput): BetPayoutResult {
  const { predictedHome, predictedAway, actualHome, actualAway, stake, oddsAtBet, groupSettings } =
    input;

  if (oddsAtBet === null) {
    return {
      payout: partialRefund(stake, groupSettings.lossPercentage),
      result1x2Correct: false,
      goalDiffCorrect: false,
      exactScoreCorrect: false,
    };
  }

  const predicted1X2 = get1X2(predictedHome, predictedAway);
  const actual1X2 = get1X2(actualHome, actualAway);
  const result1x2Correct = predicted1X2 === actual1X2;

  if (!result1x2Correct) {
    return {
      payout: partialRefund(stake, groupSettings.lossPercentage),
      result1x2Correct: false,
      goalDiffCorrect: false,
      exactScoreCorrect: false,
    };
  }

  const goalDiffCorrect = predictedHome - predictedAway === actualHome - actualAway;
  const exactScoreCorrect = predictedHome === actualHome && predictedAway === actualAway;

  let payout = Math.round(stake * oddsAtBet * groupSettings.oddsBoost);
  if (goalDiffCorrect) payout += groupSettings.bonusGoalDiff;
  if (exactScoreCorrect) payout += groupSettings.bonusExactScore;

  return { payout, result1x2Correct, goalDiffCorrect, exactScoreCorrect };
}

interface PodiumPrediction {
  gold: string;
  silver: string;
  bronze: string;
}

export function calculatePodiumPoints(
  prediction: PodiumPrediction,
  actual: PodiumPrediction,
  settings: { bonusPodiumMention: number; bonusPodiumExact: number },
): number {
  const actualTeams = new Set([actual.gold, actual.silver, actual.bronze]);
  let points = 0;
  const positions: Array<keyof PodiumPrediction> = ["gold", "silver", "bronze"];
  for (const pos of positions) {
    if (actualTeams.has(prediction[pos])) {
      points += settings.bonusPodiumMention;
      if (actual[pos] === prediction[pos]) points += settings.bonusPodiumExact;
    }
  }
  return points;
}

/**
 * Klasszikus (token nélküli) pont egy lepontozott tippre: kimenet-találat (+1),
 * gólkülönbség-találat (+1), pontos eredmény (+1) → 0..3. A flageket a scoring
 * cron írja a `bets`-be; ha még nincs pontozva (`null`), `null`-t adunk.
 */
export function classicPointsFromFlags(flags: {
  result1x2Correct: boolean | null;
  goalDiffCorrect: boolean | null;
  exactScoreCorrect: boolean | null;
}): number | null {
  if (flags.result1x2Correct == null) return null;
  return (
    (flags.result1x2Correct ? 1 : 0) +
    (flags.goalDiffCorrect ? 1 : 0) +
    (flags.exactScoreCorrect ? 1 : 0)
  );
}
