import { createOddsApiClient, ODDS_API_MULTI_MAX } from "@/lib/providers/odds-api/client";
import {
  normalizeOddsApiEvent,
  ODDS_API_BOOKMAKERS,
  selectOddsApiOdds,
} from "@/lib/providers/odds-api/normalize";
import type {
  MatchProvider,
  NormalizedOdds,
  ProviderTournamentConfig,
} from "@/lib/providers/types";

function assertOddsApi(
  cfg: ProviderTournamentConfig,
): asserts cfg is { provider: "odds-api"; sport: string; leagueSlug: string } {
  if (cfg.provider !== "odds-api") throw new Error(`Expected odds-api config, got ${cfg.provider}`);
}

export const oddsApiProvider: MatchProvider = {
  id: "odds-api",
  async fetchFixtures(cfg) {
    assertOddsApi(cfg);
    return (await createOddsApiClient().fetchEvents(cfg.sport, cfg.leagueSlug)).map(
      normalizeOddsApiEvent,
    );
  },
  async fetchOdds(cfg) {
    assertOddsApi(cfg);
    const client = createOddsApiClient();
    const events = await client.fetchEvents(cfg.sport, cfg.leagueSlug);
    const pendingIds = events.filter((e) => e.status === "pending").map((e) => e.id);

    // Batch via /odds/multi (max 10 ids per call) — the per-event /odds endpoint
    // would blow past the odds-api rate limit on large tournaments (e.g. World Cup).
    const out: NormalizedOdds[] = [];
    for (let i = 0; i < pendingIds.length; i += ODDS_API_MULTI_MAX) {
      const batch = pendingIds.slice(i, i + ODDS_API_MULTI_MAX);
      const entries = await client.fetchMultiEventOdds(batch, ODDS_API_BOOKMAKERS);
      for (const entry of entries) {
        const odds = selectOddsApiOdds(String(entry.id), entry);
        if (odds) out.push(odds);
      }
    }
    return out;
  },
};
