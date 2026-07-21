/**
 * Pure aggregation helpers for the per-match bet dialog (Tippek + Statisztika tabs).
 *
 * Everything here works on the already-fetched bets — no DB access — so it stays
 * client-safe and unit-testable. Callers pass `GroupMemberBet`-shaped objects;
 * the local `StatBet` interface keeps this module decoupled from the server-only
 * `@/queries/bets` types.
 */

export type RankMode = "profit" | "stake";

export type Outcome1x2 = "1" | "X" | "2";

/** Minimal bet shape these helpers need. `GroupMemberBet` is structurally compatible. */
export interface StatBet {
  betId: string;
  userId: string;
  predictedHome: number;
  predictedAway: number;
  stake: number;
  result1x2Correct: boolean | null;
  payout: number | null;
}

export type RankedBet<T extends StatBet> = T & { rank: number; profit: number };

/** Classifies a predicted scoreline as a home win (1), draw (X), or away win (2). */
export function classify1x2(home: number, away: number): Outcome1x2 {
  if (home > away) return "1";
  if (home < away) return "2";
  return "X";
}

/** Net profit of a settled bet. A `null` payout (unsettled / total loss) counts as 0. */
export function betProfit(bet: StatBet): number {
  return (bet.payout ?? 0) - bet.stake;
}

/**
 * Sorts bets by the chosen metric (descending) and assigns sequential 1-based ranks.
 * Ties break by stake, then by `betId` for determinism. Returns new objects.
 */
export function rankBets<T extends StatBet>(bets: readonly T[], mode: RankMode): RankedBet<T>[] {
  const metric = (bet: T) => (mode === "profit" ? betProfit(bet) : bet.stake);

  return [...bets]
    .sort((a, b) => {
      const diff = metric(b) - metric(a);
      if (diff !== 0) return diff;
      if (b.stake !== a.stake) return b.stake - a.stake;
      return a.betId.localeCompare(b.betId);
    })
    .map((bet, i) => ({ ...bet, rank: i + 1, profit: betProfit(bet) }));
}

/** A `pickTipsView` csak ezt a két mezőt igényli — így dobogó-sorokra is megy. */
export interface RankedRow {
  userId: string;
  rank: number;
}

export interface TipsView<T extends RankedRow> {
  /** Top-of-the-table rows (the podium). */
  podium: T[];
  /** Window of rows around the current user; empty when the user is in the podium or absent. */
  neighbors: T[];
  /** Count of rows hidden between the podium and the neighbor window (the "⋯ N ⋯" marker). */
  hiddenBetween: number;
  /** Total number of ranked bets. */
  total: number;
  /** The current user's rank, or null if they have no bet here. */
  currentUserRank: number | null;
}

/**
 * Builds the collapsed Tippek view for a finished match: the podium plus a window
 * of `radius` rows on each side of the current user. When the window touches the
 * podium it merges seamlessly (no gap marker).
 *
 * Bármilyen rangsorolt soron működik (`userId` + `rank`) — a meccs-tippek
 * mellett a torna dobogó-tippjeit is ez tördeli.
 */
export function pickTipsView<T extends RankedRow>(
  ranked: readonly T[],
  currentUserId: string,
  opts: { podiumSize?: number; radius?: number } = {},
): TipsView<T> {
  const podiumSize = opts.podiumSize ?? 3;
  const radius = opts.radius ?? 2;
  const total = ranked.length;

  const podium = ranked.slice(0, podiumSize);
  const userIndex = ranked.findIndex((b) => b.userId === currentUserId);
  const currentUserRank = userIndex === -1 ? null : ranked[userIndex].rank;

  // User absent or already on the podium → podium is enough.
  if (userIndex === -1 || userIndex < podiumSize) {
    return { podium, neighbors: [], hiddenBetween: 0, total, currentUserRank };
  }

  const start = Math.max(podiumSize, userIndex - radius);
  const end = Math.min(total - 1, userIndex + radius);
  const neighbors = ranked.slice(start, end + 1);

  return { podium, neighbors, hiddenBetween: start - podiumSize, total, currentUserRank };
}

/**
 * Orders bets for a live match: the current user first, then by stake descending.
 * Equal stakes break by `betId` so the order is deterministic across renders.
 */
export function sortLiveBets<T extends StatBet>(bets: readonly T[], currentUserId: string): T[] {
  return [...bets].sort((a, b) => {
    if (a.userId === currentUserId) return -1;
    if (b.userId === currentUserId) return 1;
    if (b.stake !== a.stake) return b.stake - a.stake;
    return a.betId.localeCompare(b.betId);
  });
}

export interface DistributionSlice {
  key: Outcome1x2;
  count: number;
  totalStake: number;
}

export interface MatchStats {
  betCount: number;
  /** Always three slices in `1`, `X`, `2` order. */
  distribution: DistributionSlice[];
  totalStake: number;
  avgStake: number;
  biggestStakeBetId: string | null;
  mostCommonTip: { home: number; away: number; count: number } | null;
  avgTip: { home: number; away: number } | null;
  /** Finished matches only; null while the match is live. */
  winnerCorrectCount: number | null;
}

interface MatchStatsContext {
  homeScore: number | null;
  awayScore: number | null;
  isFinished: boolean;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function buildDistribution(bets: readonly StatBet[]): DistributionSlice[] {
  const keys: Outcome1x2[] = ["1", "X", "2"];
  const totals = new Map<Outcome1x2, { count: number; totalStake: number }>(
    keys.map((k) => [k, { count: 0, totalStake: 0 }]),
  );

  for (const bet of bets) {
    const slot = totals.get(classify1x2(bet.predictedHome, bet.predictedAway));
    if (slot) {
      slot.count += 1;
      slot.totalStake += bet.stake;
    }
  }

  return keys.map((key) => {
    const slot = totals.get(key) ?? { count: 0, totalStake: 0 };
    return { key, count: slot.count, totalStake: slot.totalStake };
  });
}

function findMostCommonTip(bets: readonly StatBet[]): MatchStats["mostCommonTip"] {
  if (bets.length === 0) return null;

  const groups = new Map<string, { home: number; away: number; count: number; stake: number }>();
  for (const bet of bets) {
    const key = `${bet.predictedHome}-${bet.predictedAway}`;
    const g = groups.get(key) ?? {
      home: bet.predictedHome,
      away: bet.predictedAway,
      count: 0,
      stake: 0,
    };
    g.count += 1;
    g.stake += bet.stake;
    groups.set(key, g);
  }

  // Most frequent wins; ties break by total stake, then by lowest scoreline.
  const best = [...groups.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (b.stake !== a.stake) return b.stake - a.stake;
    if (a.home !== b.home) return a.home - b.home;
    return a.away - b.away;
  })[0];

  return { home: best.home, away: best.away, count: best.count };
}

/** Aggregates the per-match statistics shown in the Statisztika tab. */
export function computeMatchStats(bets: readonly StatBet[], ctx: MatchStatsContext): MatchStats {
  const betCount = bets.length;
  const totalStake = bets.reduce((sum, b) => sum + b.stake, 0);
  const avgStake = betCount > 0 ? Math.round(totalStake / betCount) : 0;

  const biggest = bets.reduce<StatBet | null>(
    (max, b) => (max === null || b.stake > max.stake ? b : max),
    null,
  );

  const avgTip =
    betCount > 0
      ? {
          home: round1(bets.reduce((s, b) => s + b.predictedHome, 0) / betCount),
          away: round1(bets.reduce((s, b) => s + b.predictedAway, 0) / betCount),
        }
      : null;

  const winnerCorrectCount = ctx.isFinished
    ? bets.filter((b) => b.result1x2Correct === true).length
    : null;

  return {
    betCount,
    distribution: buildDistribution(bets),
    totalStake,
    avgStake,
    biggestStakeBetId: biggest?.betId ?? null,
    mostCommonTip: findMostCommonTip(bets),
    avgTip,
    winnerCorrectCount,
  };
}

export interface BonusPoolLevel {
  /** A szint teljes kerete: `floor(max(0, poolBase) × pct / 100)`. */
  pool: number;
  /** Találók száma; `null` élő meccsen (még nincs eredmény). */
  hitters: number | null;
  /** Egy találóra eső kifizetés; `null` élőn, `0` ha lezárt de 0 találó. */
  perHitter: number | null;
}

/**
 * Egy bónusz-szint (gólkülönbség VAGY pontos eredmény) pool-kerete és — lezárt
 * meccsnél — az egy találóra eső kifizetése a Statisztika-tabhoz. A per-találó
 * képlet a scoring `distributeBonusPools`-ával azonos (floor az osztás után),
 * így a kijelzett érték a tényleges kifizetéssel egyezik. `pct <= 0` (kikapcsolt
 * bónusz) → `null`, a sor kimarad. `hitters === null` → élő meccs: csak a keret.
 */
export function computeBonusPoolLevel(
  poolBase: number,
  pct: number,
  hitters: number | null,
): BonusPoolLevel | null {
  if (pct <= 0) return null;
  const base = Math.max(0, poolBase);
  const pool = Math.floor((base * pct) / 100);
  const perHitter =
    hitters == null ? null : hitters > 0 ? Math.floor((base * pct) / 100 / hitters) : 0;
  return { pool, hitters, perHitter };
}
