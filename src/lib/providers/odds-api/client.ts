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
    // A valós API a `ft` kulcsot küldi; a `fulltime` a régi/dokumentált alak.
    periods?: {
      ft?: { home: number; away: number };
      fulltime?: { home: number; away: number };
    };
  } | null;
}

export interface OddsApiOddsResponse {
  bookmakers: Record<
    string,
    Array<{ name: string; odds: Array<{ home: string; draw: string; away: string }> }>
  >;
}

/** One entry of the `/odds/multi` array response: the same shape as `/odds` plus the event id. */
export type OddsApiMultiOddsEntry = { id: number } & OddsApiOddsResponse;

/** odds-api allows at most 10 event ids per `/odds/multi` request. */
export const ODDS_API_MULTI_MAX = 10;

/**
 * Total attempts (1 initial + 3 retries) for a transient 500. Kept small on
 * purpose: the odds-api floods 500 "Failed to fetch events" under load, and we
 * back off exponentially, so the goal is to ride out a blip without hammering
 * the API — not to retry forever.
 */
export const ODDS_API_MAX_ATTEMPTS = 4;
const ODDS_API_RETRY_BASE_DELAY_MS = 1000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createOddsApiClient(opts: { retryBaseDelayMs?: number } = {}) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) throw new Error("ODDS_API_KEY is not set");
  const key = apiKey; // narrowed to string; stable inside the closure
  const retryBaseDelayMs = opts.retryBaseDelayMs ?? ODDS_API_RETRY_BASE_DELAY_MS;

  async function getJson<T>(path: string, params: Record<string, string>): Promise<T> {
    const qs = new URLSearchParams({ apiKey: key, ...params }).toString();
    for (let attempt = 0; attempt < ODDS_API_MAX_ATTEMPTS; attempt++) {
      const res = await fetch(`${BASE}${path}?${qs}`);
      if (res.ok) return res.json() as Promise<T>;
      // Only HTTP 500 ("Failed to fetch events") is transient and worth a retry.
      // 4xx (404 League not found, 401 bad key) is permanent — fail fast.
      const isLastAttempt = attempt === ODDS_API_MAX_ATTEMPTS - 1;
      if (res.status !== 500 || isLastAttempt) {
        throw new Error(`odds-api ${path} HTTP ${res.status}`);
      }
      await sleep(retryBaseDelayMs * 2 ** attempt);
    }
    // Unreachable: the loop either returns on ok or throws on the last attempt.
    throw new Error(`odds-api ${path} exhausted retries`);
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
    fetchMultiEventOdds: (eventIds: number[], bookmakers: string[]) =>
      getJson<OddsApiMultiOddsEntry[]>("/odds/multi", {
        eventIds: eventIds.join(","),
        bookmakers: bookmakers.join(","),
      }),
  };
}
