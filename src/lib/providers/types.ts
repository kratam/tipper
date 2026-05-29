import type { routing } from "@/i18n/routing";

export type Locale = (typeof routing.locales)[number];
export type ProviderId = "api-sports" | "odds-api";
export type MatchStatus = "scheduled" | "live" | "finished" | "cancelled";

export interface NormalizedTeam {
  externalId: string;
  name: string;
  logoUrl: string | null;
}

export interface NormalizedGame {
  externalId: string;
  status: MatchStatus;
  scheduledAt: Date;
  home: NormalizedTeam;
  away: NormalizedTeam;
  homeScore: number | null;
  awayScore: number | null;
}

export interface NormalizedOdds {
  externalGameId: string;
  homeOdds: string;
  drawOdds: string;
  awayOdds: string;
}

export type ProviderTournamentConfig =
  | { provider: "api-sports"; leagueId: number; season: number }
  | { provider: "odds-api"; sport: string; leagueSlug: string };

export interface MatchProvider {
  readonly id: ProviderId;
  fetchFixtures(cfg: ProviderTournamentConfig, locales: Locale[]): Promise<NormalizedGame[]>;
  fetchOdds(cfg: ProviderTournamentConfig): Promise<NormalizedOdds[]>;
  fetchTournamentLogo?(cfg: ProviderTournamentConfig): Promise<string | null>;
}

export interface ProviderColumns {
  provider: ProviderId;
  apiLeagueId: number | null;
  apiSeason: number | null;
  providerSport: string | null;
  providerLeagueSlug: string | null;
}

export function toProviderConfig(t: ProviderColumns): ProviderTournamentConfig {
  if (t.provider === "api-sports") {
    if (t.apiLeagueId == null || t.apiSeason == null)
      throw new Error("api-sports tournament is missing apiLeagueId/apiSeason");
    return { provider: "api-sports", leagueId: t.apiLeagueId, season: t.apiSeason };
  }
  if (t.provider === "odds-api") {
    if (!t.providerSport || !t.providerLeagueSlug)
      throw new Error("odds-api tournament is missing providerSport/providerLeagueSlug");
    return { provider: "odds-api", sport: t.providerSport, leagueSlug: t.providerLeagueSlug };
  }
  throw new Error(`Unknown provider: ${t.provider satisfies never}`);
}
