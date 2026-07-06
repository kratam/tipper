type Outcome = "1" | "X" | "2";

export function get1X2(home: number, away: number): Outcome {
  if (home > away) return "1";
  if (home === away) return "X";
  return "2";
}

function partialRefund(stake: number, lossPercentage: number): number {
  const clamped = Math.max(0, Math.min(100, lossPercentage));
  return Math.round((stake * (100 - clamped)) / 100);
}

export interface BaseBetPayoutInput {
  predictedHome: number;
  predictedAway: number;
  actualHome: number;
  actualAway: number;
  stake: number;
  oddsAtBet: number | null;
  oddsBoost: number;
  lossPercentage: number;
}

export interface BaseBetPayoutResult {
  basePayout: number;
  result1x2Correct: boolean;
  goalDiffCorrect: boolean;
  exactScoreCorrect: boolean;
}

/**
 * Tippenkénti pure alap-payout (bónusz NÉLKÜL) + a három találat-flag.
 * A dinamikus gólkülönbség/pontos eredmény bónusz a meccs ÖSSZES találójától
 * függ (pool szétosztása), ezért külön fázisban (distributeBonusPools) adódik
 * hozzá a scoreMatch-ben — nem itt.
 */
export function calculateBaseBetPayout(input: BaseBetPayoutInput): BaseBetPayoutResult {
  const {
    predictedHome,
    predictedAway,
    actualHome,
    actualAway,
    stake,
    oddsAtBet,
    oddsBoost,
    lossPercentage,
  } = input;

  if (oddsAtBet === null) {
    return {
      basePayout: partialRefund(stake, lossPercentage),
      result1x2Correct: false,
      goalDiffCorrect: false,
      exactScoreCorrect: false,
    };
  }

  const result1x2Correct = get1X2(predictedHome, predictedAway) === get1X2(actualHome, actualAway);
  if (!result1x2Correct) {
    return {
      basePayout: partialRefund(stake, lossPercentage),
      result1x2Correct: false,
      goalDiffCorrect: false,
      exactScoreCorrect: false,
    };
  }

  const goalDiffCorrect = predictedHome - predictedAway === actualHome - actualAway;
  const exactScoreCorrect = predictedHome === actualHome && predictedAway === actualAway;
  const basePayout = Math.round(stake * oddsAtBet * oddsBoost);
  return { basePayout, result1x2Correct, goalDiffCorrect, exactScoreCorrect };
}

/**
 * A meccs aktív tippelőinek összes lifetime budgetje (a „játékban lévő tokenek"):
 * fejenként initialTokens + tokenPerMatch × addigi meccsek + rendezett tét-nettók.
 * Ez a dinamikus bónusz-pool alapja. Mindig ≥ 0 a gyakorlatban, és a torna
 * során nő. A nyers ledger-egyenleg helyett ezt használjuk, mert az mid-torna
 * torzított (a jövőbeli tétek már levonódtak, de a jövőbeli osztás még nem).
 */
export function computePoolBase(input: {
  initialTokens: number;
  tokenPerMatch: number;
  matchesToDate: number;
  bettorResolvedNets: number[];
}): number {
  const { initialTokens, tokenPerMatch, matchesToDate, bettorResolvedNets } = input;
  const perBettorFloor = initialTokens + tokenPerMatch * matchesToDate;
  return bettorResolvedNets.reduce((sum, net) => sum + perBettorFloor + net, 0);
}

/**
 * A pool a bázis P%-a, egyenlően szétosztva az adott szint találói között
 * (lefelé kerekítve; a maradék nem minteledik). A gólkülönbség- és
 * pontos-eredmény-pool külön és halmozható (pontos eredmény ⊆ gólkülönbség →
 * a telitalálós mindkét poolból részesedik). 0 találó → 0 az adott szinten.
 */
export function distributeBonusPools(input: {
  poolBase: number;
  goalDiffHitters: number;
  exactScoreHitters: number;
  goalDiffPct: number;
  exactScorePct: number;
}): { goalDiffPerHitter: number; exactScorePerHitter: number } {
  const pool = Math.max(0, input.poolBase);
  const goalDiffPerHitter =
    input.goalDiffHitters > 0
      ? Math.floor((pool * input.goalDiffPct) / 100 / input.goalDiffHitters)
      : 0;
  const exactScorePerHitter =
    input.exactScoreHitters > 0
      ? Math.floor((pool * input.exactScorePct) / 100 / input.exactScoreHitters)
      : 0;
  return { goalDiffPerHitter, exactScorePerHitter };
}

/**
 * A dobogó-bónusz per-játékos token-egysége. A meccsszám-arányos „floor"-hoz
 * horgonyzott: pct%-a a csoport (tokenPerMatch × meccsszám) keretének. Lefelé
 * kerekít. A torna végén egyszer, a `finishTournament`-ben hívva.
 */
export function computePodiumUnit(pct: number, tokenPerMatch: number, matchCount: number): number {
  return Math.floor((pct / 100) * tokenPerMatch * matchCount);
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
