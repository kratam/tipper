const BASE_URL = "https://v1.hockey.api-sports.io";

function getHeaders(): HeadersInit {
  return { "x-apisports-key": process.env.API_SPORTS_KEY! };
}

export function parsePeriodsString(period: string | null): [number, number] {
  if (!period) return [0, 0];
  const [home, away] = period.split("-").map(Number);
  return [home, away];
}

export interface ApiPeriods {
  first: string | null;
  second: string | null;
  third: string | null;
  overtime: string | null;
  penalties: string | null;
}

export function parseRegulationScore(periods: ApiPeriods): {
  home: number;
  away: number;
} {
  const [h1, a1] = parsePeriodsString(periods.first);
  const [h2, a2] = parsePeriodsString(periods.second);
  const [h3, a3] = parsePeriodsString(periods.third);
  return { home: h1 + h2 + h3, away: a1 + a2 + a3 };
}

export function mapApiStatus(
  apiStatus: string,
): "scheduled" | "live" | "finished" | "cancelled" {
  switch (apiStatus) {
    case "NS":
      return "scheduled";
    case "FT":
    case "AOT":
    case "AP":
      return "finished";
    case "CANC":
    case "POST":
      return "cancelled";
    default:
      return "live";
  }
}

export interface ApiGame {
  id: number;
  date: string;
  status: { short: string };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  scores: { home: number | null; away: number | null };
  periods: ApiPeriods;
}

interface ApiOddsValue {
  value: string;
  odd: string;
}

interface ApiOddsBet {
  id: number;
  name: string;
  values: ApiOddsValue[];
}

interface ApiOddsBookmaker {
  id: number;
  name: string;
  bets: ApiOddsBet[];
}

export interface ApiOddsGame {
  game: { id: number };
  bookmakers: ApiOddsBookmaker[];
}

export function extract3WayOdds(
  oddsGame: ApiOddsGame,
): { homeOdds: string; drawOdds: string; awayOdds: string } | null {
  for (const bookmaker of oddsGame.bookmakers) {
    const threeWay = bookmaker.bets.find(
      (b) => b.name === "3Way Result" || b.name === "Match Winner",
    );
    if (threeWay && threeWay.values.length >= 3) {
      const home = threeWay.values.find((v) => v.value === "Home");
      const draw = threeWay.values.find((v) => v.value === "Draw");
      const away = threeWay.values.find((v) => v.value === "Away");
      if (home && draw && away) {
        return { homeOdds: home.odd, drawOdds: draw.odd, awayOdds: away.odd };
      }
    }
  }
  return null;
}

export async function fetchGames(
  leagueId: number,
  season: number,
): Promise<ApiGame[]> {
  const res = await fetch(
    `${BASE_URL}/games?league=${leagueId}&season=${season}`,
    { headers: getHeaders() },
  );
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return data.response;
}

export async function fetchOdds(
  leagueId: number,
  season: number,
): Promise<ApiOddsGame[]> {
  const res = await fetch(
    `${BASE_URL}/odds?league=${leagueId}&season=${season}`,
    { headers: getHeaders() },
  );
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return data.response;
}
