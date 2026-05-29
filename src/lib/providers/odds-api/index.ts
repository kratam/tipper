import { createOddsApiClient } from "@/lib/providers/odds-api/client";
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
    const out: NormalizedOdds[] = [];
    for (const e of events) {
      if (e.status !== "pending") continue;
      const resp = await client.fetchEventOdds(e.id, ODDS_API_BOOKMAKERS);
      const odds = selectOddsApiOdds(String(e.id), resp);
      if (odds) out.push(odds);
    }
    return out;
  },
};
