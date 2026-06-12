import type { OddsApiEvent, OddsApiOddsResponse } from "@/lib/providers/odds-api/client";
import type { MatchStatus, NormalizedGame, NormalizedOdds } from "@/lib/providers/types";

export const ODDS_API_BOOKMAKERS = ["TippmixPRO", "Bet365"];

const STATUS_MAP: Record<OddsApiEvent["status"], MatchStatus> = {
  pending: "scheduled",
  live: "live",
  settled: "finished",
};

export function normalizeOddsApiEvent(e: OddsApiEvent): NormalizedGame {
  const status = STATUS_MAP[e.status] ?? "scheduled";
  const ft = e.scores?.periods?.ft ?? e.scores?.periods?.fulltime;
  const home = status === "finished" ? (ft?.home ?? e.scores?.home ?? null) : null;
  const away = status === "finished" ? (ft?.away ?? e.scores?.away ?? null) : null;
  return {
    externalId: String(e.id),
    status,
    scheduledAt: new Date(e.date),
    home: { externalId: String(e.homeId), name: e.home, logoUrl: null },
    away: { externalId: String(e.awayId), name: e.away, logoUrl: null },
    homeScore: home,
    awayScore: away,
  };
}

export function selectOddsApiOdds(
  eventId: string,
  resp: OddsApiOddsResponse,
): NormalizedOdds | null {
  const bookmakers = resp.bookmakers ?? {};
  const names = [
    ...ODDS_API_BOOKMAKERS,
    ...Object.keys(bookmakers).filter((n) => !ODDS_API_BOOKMAKERS.includes(n)),
  ];
  for (const name of names) {
    const ml = bookmakers[name]?.find((m) => m.name === "ML");
    const odd = ml?.odds[0];
    if (odd?.home != null && odd.draw != null && odd.away != null) {
      return {
        externalGameId: eventId,
        homeOdds: odd.home,
        drawOdds: odd.draw,
        awayOdds: odd.away,
      };
    }
  }
  return null;
}
