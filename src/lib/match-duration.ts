// A meccs várható hossza sportonként — ennyivel a kezdés után fut le az első
// QStash match-finish check (lásd cron/periodic + cron/match-finish).

// 1h50m: az átlagos foci meccs ~112 perc alatt ténylegesen véget ér, ezért az
// első match-finish poll 5 perccel a 2×45'+szünet+ráadás becsült vége ELŐTT indul,
// hogy a korán végződő meccseket is gyorsan elkapjuk (lásd
// docs/superpowers/specs/2026-06-24-match-finish-faster-scoring.md).
const FOOTBALL_DURATION_MS = (1 * 60 + 50) * 60 * 1000; // 1h50m
const DEFAULT_DURATION_MS = 2.5 * 60 * 60 * 1000; // 2h30m (jégkorong / egyéb)

/**
 * A `providerSport` szabad szöveg (odds-api); az api-sports (jégkorong) tornák
 * providerSport-ja NULL → default 2h30m. `football` → 1h55m.
 */
export function expectedMatchDurationMs(providerSport: string | null): number {
  return providerSport === "football" ? FOOTBALL_DURATION_MS : DEFAULT_DURATION_MS;
}
