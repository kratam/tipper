const BASE = "https://api.odds-api.io/v3";

export interface OddsApiEvent {
  id: number;
  home: string;
  away: string;
  homeId: number;
  awayId: number;
  date: string;
  status: "pending" | "live" | "settled";
  scores: {
    home: number;
    away: number;
    periods?: { fulltime?: { home: number; away: number } };
  } | null;
}

export interface OddsApiOddsResponse {
  bookmakers: Record<
    string,
    Array<{ name: string; odds: Array<{ home: string; draw: string; away: string }> }>
  >;
}

export function createOddsApiClient() {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) throw new Error("ODDS_API_KEY is not set");

  async function getJson<T>(path: string, params: Record<string, string>): Promise<T> {
    const qs = new URLSearchParams({ apiKey, ...params }).toString();
    const res = await fetch(`${BASE}${path}?${qs}`);
    if (!res.ok) throw new Error(`odds-api ${path} HTTP ${res.status}`);
    return res.json() as Promise<T>;
  }

  return {
    fetchLeagues: (sport: string) =>
      getJson<Array<{ name: string; slug: string; eventsCount: number }>>("/leagues", { sport }),
    fetchEvents: (sport: string, leagueSlug: string) =>
      getJson<OddsApiEvent[]>("/events", { sport, league: leagueSlug }),
    fetchEventOdds: (eventId: number, bookmakers: string[]) =>
      getJson<OddsApiOddsResponse>("/odds", {
        eventId: String(eventId),
        bookmakers: bookmakers.join(","),
      }),
  };
}
