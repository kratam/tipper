/**
 * Tipp-tábla (mátrix-ranglista) pure logikája: forduló-csoportosítás,
 * alapforduló-választás, lock-detektálás, adatvédelmi szűrés, nettó számítás.
 * Tesztelve: tests/lib/tip-matrix.test.ts.
 */

export type MatchStatus = "scheduled" | "live" | "finished" | "cancelled";

export interface RoundMatchInput {
  id: string;
  round: string;
  scheduledAt: Date;
  status: MatchStatus;
}

export interface RoundGroup {
  key: string;
  label: string;
  matchIds: string[];
  minScheduledAt: number;
}

/**
 * A meccseket `round` szerint csoportosítja, a fordulókat a bennük lévő
 * legkorábbi `scheduledAt` szerint növekvő sorrendbe rakja, a fordulón belül a
 * meccseket szintén `scheduledAt` szerint rendezi.
 */
export function groupMatchesIntoRounds(matches: readonly RoundMatchInput[]): RoundGroup[] {
  const byRound = new Map<string, RoundMatchInput[]>();
  for (const m of matches) {
    const list = byRound.get(m.round) ?? [];
    list.push(m);
    byRound.set(m.round, list);
  }

  const rounds: RoundGroup[] = [];
  for (const [key, list] of byRound) {
    const sorted = [...list].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
    rounds.push({
      key,
      label: key,
      matchIds: sorted.map((m) => m.id),
      minScheduledAt: sorted[0].scheduledAt.getTime(),
    });
  }

  rounds.sort((a, b) => a.minScheduledAt - b.minScheduledAt);
  return rounds;
}

/**
 * Az alapértelmezett forduló: a legkésőbbi forduló, amelyben már van elkezdődött
 * meccs; ha egyik forduló sem kezdődött el, a legkorábbi forduló. Üres listára null.
 */
export function pickDefaultRoundKey(
  rounds: readonly RoundGroup[],
  startedMatchIds: ReadonlySet<string>,
): string | null {
  if (rounds.length === 0) return null;
  for (let i = rounds.length - 1; i >= 0; i--) {
    if (rounds[i].matchIds.some((id) => startedMatchIds.has(id))) {
      return rounds[i].key;
    }
  }
  return rounds[0].key;
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
