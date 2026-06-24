/**
 * Tipp-tábla (mátrix-ranglista) pure logikája: forduló-levezetés a menetrendből,
 * alapforduló-választás, lock-detektálás, adatvédelmi szűrés, nettó számítás.
 * Tesztelve: tests/lib/tip-matrix.test.ts.
 */

export type MatchStatus = "scheduled" | "live" | "finished" | "cancelled";

export interface RoundMatchInput {
  id: string;
  scheduledAt: Date;
  homeTeamId: string;
  awayTeamId: string;
  /** Hamis, ha bármelyik résztvevő placeholder (pl. „1A", „W73") — kieséses bracket. */
  participantsKnown: boolean;
}

export type RoundKind = "group" | "knockout";

export interface RoundGroup {
  key: string;
  kind: RoundKind;
  /** Csoportköri forduló sorszáma (kind==="group"), egyébként null. */
  groupNumber: number | null;
  /** A kieséses kör csapatszáma (kind==="knockout"): 32/16/8/4…, egyébként null. */
  knockoutTeams: number | null;
  /** Az utolsó kieséses kör (döntő, esetleg + 3. helyért). */
  isFinal: boolean;
  matchIds: string[];
  minScheduledAt: number;
}

function byDateId(a: RoundMatchInput, b: RoundMatchInput): number {
  return (
    a.scheduledAt.getTime() - b.scheduledAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/**
 * Egy kieséses bracket köreinek mérete a meccsszámból, felezéssel. Az utolsó
 * 1–2 meccs egy körbe kerül (döntő, esetleg + 3. helyért).
 * Pl. 32 → [16,8,4,2,2]; 31 → [16,8,4,2,1]; 16 → [8,4,2,2].
 */
export function knockoutBucketSizes(p: number): number[] {
  if (p <= 0) return [];
  if (p <= 2) return [p];
  let pow = 1;
  while (pow * 2 <= p) pow *= 2;
  let cur = pow === p ? pow / 2 : pow;
  const sizes: number[] = [];
  let rem = p;
  while (rem > 0) {
    if (rem <= 2) {
      sizes.push(rem);
      rem = 0;
    } else {
      const take = Math.min(cur, rem);
      sizes.push(take);
      rem -= take;
      cur = Math.max(1, Math.floor(cur / 2));
    }
  }
  return sizes;
}

/**
 * Valódi fordulókat vezet le a menetrendből — a tárolt `round` (= dátum) helyett.
 *
 * - **Round-robin rész (csoportkör):** egy meccs fordulója = a két csapat
 *   hányadik meccse (per-csapat megjelenés-számláló). Így minden csapat egyszer
 *   játszik fordulónként, akkor is, ha a forduló több napon át tart, vagy a
 *   fordulók dátumai átfednek. A csoportkör = a kezdő, „teli" (azonos méretű) körök.
 * - **Kieséses rész:** a placeholder-bracket (és a már lejátszott, csoportkörön
 *   túli) meccsek kronológikusan felezéssel körökre bontva (R32/Nyolcad/…/Döntő).
 *   Placeholder-független, ezért stabil a torna előrehaladtával.
 */
export function deriveRounds(matches: readonly RoundMatchInput[]): RoundGroup[] {
  if (matches.length === 0) return [];
  const sorted = [...matches].sort(byDateId);

  // 1. Megjelenés-forduló az ISMERT résztvevőjű meccsekre.
  const appearances = new Map<string, number>();
  const appRound = new Map<string, number>();
  for (const m of sorted) {
    if (!m.participantsKnown) continue;
    const h = appearances.get(m.homeTeamId) ?? 0;
    const a = appearances.get(m.awayTeamId) ?? 0;
    appRound.set(m.id, Math.max(h, a) + 1);
    appearances.set(m.homeTeamId, h + 1);
    appearances.set(m.awayTeamId, a + 1);
  }

  // 2. Csoportkör hossza G = a kezdő körök, amelyek mérete = az 1. kör mérete.
  const countByRound = new Map<number, number>();
  for (const r of appRound.values()) countByRound.set(r, (countByRound.get(r) ?? 0) + 1);
  const firstCount = countByRound.get(1) ?? 0;
  let groupRounds = 0;
  while (firstCount > 0 && (countByRound.get(groupRounds + 1) ?? 0) === firstCount) {
    groupRounds++;
  }

  // 3. Szétválasztás: csoportköri meccsek (appRound ≤ G) vs. kieséses (a többi).
  const groupMatches: RoundMatchInput[] = [];
  const knockoutMatches: RoundMatchInput[] = [];
  for (const m of sorted) {
    const r = appRound.get(m.id);
    if (r != null && r <= groupRounds) groupMatches.push(m);
    else knockoutMatches.push(m);
  }

  const rounds: RoundGroup[] = [];

  // 4. Csoportköri körök (sorszámozva).
  const groupByRound = new Map<number, RoundMatchInput[]>();
  for (const m of groupMatches) {
    const r = appRound.get(m.id) as number;
    const list = groupByRound.get(r);
    if (list) list.push(m);
    else groupByRound.set(r, [m]);
  }
  for (const [r, list] of groupByRound) {
    const ls = [...list].sort(byDateId);
    rounds.push({
      key: `g${r}`,
      kind: "group",
      groupNumber: r,
      knockoutTeams: null,
      isFinal: false,
      matchIds: ls.map((m) => m.id),
      minScheduledAt: ls[0].scheduledAt.getTime(),
    });
  }

  // 5. Kieséses körök (kronológikus felezés).
  if (knockoutMatches.length > 0) {
    const ks = [...knockoutMatches].sort(byDateId);
    const sizes = knockoutBucketSizes(ks.length);
    let idx = 0;
    for (let b = 0; b < sizes.length; b++) {
      const slice = ks.slice(idx, idx + sizes[b]);
      idx += sizes[b];
      rounds.push({
        key: `k${b + 1}`,
        kind: "knockout",
        groupNumber: null,
        knockoutTeams: sizes[b] * 2,
        isFinal: b === sizes.length - 1,
        matchIds: slice.map((m) => m.id),
        minScheduledAt: slice[0].scheduledAt.getTime(),
      });
    }
  }

  rounds.sort((a, b) => a.minScheduledAt - b.minScheduledAt);
  return rounds;
}

/**
 * Az alapértelmezett forduló: az első forduló, amelynek van még el nem kezdődött
 * (tippelhető) meccse — ide kell legközelebb tippelni. Ha minden meccs elkezdődött
 * (vége a tornának), a legkésőbbi forduló. Üres listára null.
 */
export function pickDefaultRoundKey(
  rounds: readonly RoundGroup[],
  startedMatchIds: ReadonlySet<string>,
): string | null {
  if (rounds.length === 0) return null;
  for (const round of rounds) {
    if (round.matchIds.some((id) => !startedMatchIds.has(id))) {
      return round.key;
    }
  }
  return rounds[rounds.length - 1].key;
}

/** Lockolt egy meccs, ha már nem fogadható: nem `scheduled`, vagy a kezdés elmúlt. */
export function isMatchLocked(status: MatchStatus, scheduledAt: Date, now: Date): boolean {
  return status !== "scheduled" || scheduledAt.getTime() <= now.getTime();
}

/**
 * Adatvédelmi szűrés: lockolt meccsen minden tipp látható; még nem lockolt
 * (jövőbeli) meccsen csak a néző saját tippje. Mások jövőbeli tippje SOHA nem
 * kerülhet a kliensre — ezt itt, szerver-oldalon vágjuk le.
 */
export function filterRoundBetsForViewer<T extends { matchId: string; userId: string }>(
  bets: readonly T[],
  lockedMatchIds: ReadonlySet<string>,
  currentUserId: string,
): T[] {
  return bets.filter((b) => lockedMatchIds.has(b.matchId) || b.userId === currentUserId);
}

/** A cella nettó token-hozama: payout − tét, vagy null, ha még nincs lepontozva. */
export function betNet(payout: number | null, stake: number): number | null {
  return payout == null ? null : payout - stake;
}

export type MatrixScope = "total" | "round";

/** A ranglista egy sora a mátrix-megjelenítéshez (globális adatok). */
export interface MatrixRowInput {
  rank: number;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  profit: number;
}

/** A mátrix egy megjelenítendő sora — `value`/`rank` a választott `scope` szerint. */
export interface MatrixRowDisplay {
  rank: number;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  value: number;
}

/**
 * A Tipp-tábla sorait állítja össze a választott hatókör szerint.
 *
 * - `"total"`: a bemeneti (globális) sorrend és helyezés változatlan, az érték a
 *   teljes `profit`.
 * - `"round"`: az érték az adott forduló nettó pontja userenként (`betNet`
 *   összege a `payout != null` tippekre; lepontozatlan tipp kimarad), a sorok
 *   csökkenő pont szerint újrarendezve. Holtversenynél a stabil rendezés a
 *   bemeneti globális sorrendet tartja; a helyezés az új sorrend `index + 1`-e
 *   (megegyezik a globális leaderboard szekvenciális rank-konvenciójával).
 */
export function buildMatrixRows(
  rows: readonly MatrixRowInput[],
  bets: readonly { userId: string; payout: number | null; stake: number }[],
  scope: MatrixScope,
): MatrixRowDisplay[] {
  if (scope === "total") {
    return rows.map((r) => ({
      rank: r.rank,
      userId: r.userId,
      userName: r.userName,
      userAvatarUrl: r.userAvatarUrl,
      value: r.profit,
    }));
  }

  const scoreByUser = new Map<string, number>();
  for (const b of bets) {
    const net = betNet(b.payout, b.stake);
    // A null (még le nem pontozott) tipp kimarad — ez egyben az adatvédelmi
    // garancia is: lepontozott tipp csak lockolt (befejezett) meccsen van, amit
    // minden néző lát; a más-felhasználó jövőbeli tippje (null payout) sosem
    // kerülhet a forduló-pontba (lásd filterRoundBetsForViewer).
    if (net == null) continue;
    scoreByUser.set(b.userId, (scoreByUser.get(b.userId) ?? 0) + net);
  }

  return rows
    .map((r) => ({
      userId: r.userId,
      userName: r.userName,
      userAvatarUrl: r.userAvatarUrl,
      value: scoreByUser.get(r.userId) ?? 0,
    }))
    .sort((a, b) => b.value - a.value)
    .map((r, index) => ({ ...r, rank: index + 1 }));
}
