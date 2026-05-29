import {
  type ApiGame,
  type ApiOddsGame,
  extract3WayOdds,
  fetchGames,
  fetchLeagueLogoUrl,
  fetchOdds,
  mapApiStatus,
  parseRegulationScore,
} from "@/lib/api-sports";
import type {
  MatchProvider,
  NormalizedGame,
  NormalizedOdds,
  ProviderTournamentConfig,
} from "@/lib/providers/types";

export function normalizeApiGame(game: ApiGame): NormalizedGame {
  const status = mapApiStatus(game.status.short);
  const regulation = parseRegulationScore(game.periods);
  return {
    externalId: String(game.id),
    status,
    scheduledAt: new Date(game.date),
    home: {
      externalId: String(game.teams.home.id),
      name: game.teams.home.name,
      logoUrl: game.teams.home.logo,
    },
    away: {
      externalId: String(game.teams.away.id),
      name: game.teams.away.name,
      logoUrl: game.teams.away.logo,
    },
    homeScore: status === "finished" ? regulation.home : game.scores.home,
    awayScore: status === "finished" ? regulation.away : game.scores.away,
  };
}

export function normalizeApiOdds(oddsGame: ApiOddsGame): NormalizedOdds | null {
  const t = extract3WayOdds(oddsGame);
  if (!t) return null;
  return {
    externalGameId: String(oddsGame.game.id),
    homeOdds: t.homeOdds,
    drawOdds: t.drawOdds,
    awayOdds: t.awayOdds,
  };
}

function assertApiSports(
  cfg: ProviderTournamentConfig,
): asserts cfg is { provider: "api-sports"; leagueId: number; season: number } {
  if (cfg.provider !== "api-sports")
    throw new Error(`Expected api-sports config, got ${cfg.provider}`);
}

export const apiSportsProvider: MatchProvider = {
  id: "api-sports",
  async fetchFixtures(cfg, _locales) {
    assertApiSports(cfg);
    return (await fetchGames(cfg.leagueId, cfg.season)).map(normalizeApiGame);
  },
  async fetchOdds(cfg) {
    assertApiSports(cfg);
    return (await fetchOdds(cfg.leagueId, cfg.season))
      .map(normalizeApiOdds)
      .filter((o): o is NormalizedOdds => o !== null);
  },
  async fetchTournamentLogo(cfg) {
    assertApiSports(cfg);
    return fetchLeagueLogoUrl(cfg.leagueId);
  },
};
