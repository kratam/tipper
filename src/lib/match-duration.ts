// A meccs várható hossza sportonként — ennyivel a kezdés után fut le az első
// QStash match-finish check (lásd cron/periodic + cron/match-finish).

const FOOTBALL_DURATION_MS = (1 * 60 + 55) * 60 * 1000; // 1h55m (2×45' + szünet + ráadás)
const DEFAULT_DURATION_MS = 2.5 * 60 * 60 * 1000; // 2h30m (jégkorong / egyéb)

/**
 * A `providerSport` szabad szöveg (odds-api); az api-sports (jégkorong) tornák
 * providerSport-ja NULL → default 2h30m. `football` → 1h55m.
 */
export function expectedMatchDurationMs(providerSport: string | null): number {
  return providerSport === "football" ? FOOTBALL_DURATION_MS : DEFAULT_DURATION_MS;
}
