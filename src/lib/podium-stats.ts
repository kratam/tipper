/**
 * Pure aggregation helpers for the tournament podium tab — a `match-stats.ts`
 * mintájára: DB-mentes, kliens-biztos, unit-tesztelt.
 *
 * A pontszámítás forrása a `scoring.ts` `calculatePodiumPoints`-a (azt futtatja
 * a torna lezárása is); az itteni `podiumPointsFromHits` ugyanazt a szabályt
 * bontja pozíciónkénti találatokra, hogy a UI meg tudja jelölni, melyik tipp
 * volt pontos és melyik csak említés. A két út egyezését teszt őrzi.
 */

/** Egy pozíció találat-típusa: helyén van / dobogós de máshol / nincs a dobogón. */
export type PodiumHit = "exact" | "mention" | "miss";

export type PodiumSlot = "gold" | "silver" | "bronze";

export interface PodiumHits {
  gold: PodiumHit;
  silver: PodiumHit;
  bronze: PodiumHit;
}

/** A dobogó-tipp minimál alakja. A query sorai strukturálisan kompatibilisek. */
export interface PodiumStatBet {
  betId: string;
  userId: string;
  goldTeamId: string;
  silverTeamId: string;
  bronzeTeamId: string;
}

/** A torna tényleges dobogója; `null`, amíg nincs lezárva. */
export interface PodiumResult {
  gold: string;
  silver: string;
  bronze: string;
}

export interface PodiumUnits {
  bonusPodiumMention: number;
  bonusPodiumExact: number;
}

export type RankedPodiumBet<T extends PodiumStatBet> = T & {
  rank: number;
  points: number;
  hits: PodiumHits;
};

const SLOTS: PodiumSlot[] = ["gold", "silver", "bronze"];

function predictionOf(bet: PodiumStatBet): PodiumResult {
  return { gold: bet.goldTeamId, silver: bet.silverTeamId, bronze: bet.bronzeTeamId };
}

/** Pozíciónkénti találat-típus a tényleges dobogóhoz mérve. */
export function podiumHits(bet: PodiumStatBet, actual: PodiumResult): PodiumHits {
  const prediction = predictionOf(bet);
  const actualTeams = new Set([actual.gold, actual.silver, actual.bronze]);

  const hitFor = (slot: PodiumSlot): PodiumHit => {
    const picked = prediction[slot];
    if (!actualTeams.has(picked)) return "miss";
    return actual[slot] === picked ? "exact" : "mention";
  };

  return { gold: hitFor("gold"), silver: hitFor("silver"), bronze: hitFor("bronze") };
}

/**
 * A találatokból járó tokenek. Említés → mention-egység; pontos hely → mention
 * + exact egység (a scoring `calculatePodiumPoints` ugyanígy összegez).
 */
export function podiumPointsFromHits(hits: PodiumHits, units: PodiumUnits): number {
  let points = 0;
  for (const slot of SLOTS) {
    if (hits[slot] === "miss") continue;
    points += units.bonusPodiumMention;
    if (hits[slot] === "exact") points += units.bonusPodiumExact;
  }
  return points;
}

function rankBy<T extends PodiumStatBet>(
  bets: readonly T[],
  actual: PodiumResult,
  pointsOf: (bet: T, hits: PodiumHits) => number,
): RankedPodiumBet<T>[] {
  return [...bets]
    .map((bet) => {
      const hits = podiumHits(bet, actual);
      return { ...bet, hits, points: pointsOf(bet, hits) };
    })
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return a.betId.localeCompare(b.betId);
    })
    .map((bet, i) => ({ ...bet, rank: i + 1 }));
}

/**
 * Pont szerint csökkenő rangsor a bónusz-egységekből SZÁMOLVA, 1-alapú
 * rangokkal. Holtversenyt a `betId` bont, hogy a sorrend renderek között se
 * ugráljon.
 */
export function rankPodiumBets<T extends PodiumStatBet>(
  bets: readonly T[],
  actual: PodiumResult,
  units: PodiumUnits,
): RankedPodiumBet<T>[] {
  return rankBy(bets, actual, (_bet, hits) => podiumPointsFromHits(hits, units));
}

/**
 * Ugyanaz, de a pont a TÉNYLEGESEN jóváírt tokenből (ledger) jön — ezt mutatja
 * a UI. A csoport bónusz-százaléka és a torna meccsszáma a lezárás óta
 * változhatott, ilyenkor az újraszámolt érték nem azt mondaná, amit a játékos
 * valóban kapott (és amit a ranglista is tartalmaz). Jóváírás nélküli tipp = 0,
 * mert a lezárás 0 pontra nem ír ledger-sort.
 */
export function rankPodiumBetsByPaid<T extends PodiumStatBet>(
  bets: readonly T[],
  actual: PodiumResult,
  paidByUser: Record<string, number>,
): RankedPodiumBet<T>[] {
  return rankBy(bets, actual, (bet) => paidByUser[bet.userId] ?? 0);
}

export interface TeamPickCount {
  teamId: string;
  count: number;
}

export interface PodiumStats {
  betCount: number;
  /** Csapatonkénti tippszám az adott helyre, csökkenő sorrendben. */
  goldPicks: TeamPickCount[];
  silverPicks: TeamPickCount[];
  bronzePicks: TeamPickCount[];
  /** Mindhárom helyet eltalálók száma; `null`, amíg a torna nincs lezárva. */
  perfectCount: number | null;
  /** Az aranyérmest eltalálók száma; `null`, amíg a torna nincs lezárva. */
  goldCorrectCount: number | null;
}

function countPicks(bets: readonly PodiumStatBet[], slot: PodiumSlot): TeamPickCount[] {
  const counts = new Map<string, number>();
  for (const bet of bets) {
    const teamId = predictionOf(bet)[slot];
    counts.set(teamId, (counts.get(teamId) ?? 0) + 1);
  }

  // Gyakoriság szerint; holtversenyben csapat-azonosító, hogy stabil legyen.
  return [...counts.entries()]
    .map(([teamId, count]) => ({ teamId, count }))
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.teamId.localeCompare(b.teamId)));
}

/** A Statisztika-nézet aggregátumai. `actual === null` → a torna még nyitott. */
export function computePodiumStats(
  bets: readonly PodiumStatBet[],
  actual: PodiumResult | null,
): PodiumStats {
  const hitsList = actual ? bets.map((bet) => podiumHits(bet, actual)) : null;

  return {
    betCount: bets.length,
    goldPicks: countPicks(bets, "gold"),
    silverPicks: countPicks(bets, "silver"),
    bronzePicks: countPicks(bets, "bronze"),
    perfectCount:
      hitsList?.filter((h) => SLOTS.every((slot) => h[slot] === "exact")).length ?? null,
    goldCorrectCount: hitsList?.filter((h) => h.gold === "exact").length ?? null,
  };
}
