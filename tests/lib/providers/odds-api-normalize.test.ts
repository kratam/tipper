import { describe, expect, it } from "vitest";
import type { OddsApiEvent } from "@/lib/providers/odds-api/client";
import {
  normalizeOddsApiEvent,
  ODDS_API_BOOKMAKERS,
  selectOddsApiOdds,
} from "@/lib/providers/odds-api/normalize";

// A valós odds-api válaszban a periods kulcs `ft` (nem `fulltime`) — lásd
// 2026-06-12 WC incidens: {'home': 2, 'away': 0, 'periods': {'ft': {...}, 'p1': {...}}}
const settled: OddsApiEvent = {
  id: 1,
  home: "Hungary",
  away: "Brazil",
  homeId: 10,
  awayId: 20,
  date: "2026-06-01T18:00:00Z",
  status: "settled",
  scores: { home: 1, away: 3, periods: { ft: { home: 1, away: 3 } } },
};

describe("normalizeOddsApiEvent", () => {
  it("maps a settled event to finished with fulltime score and provider name (no logo)", () => {
    const g = normalizeOddsApiEvent(settled);
    expect(g.externalId).toBe("1");
    expect(g.status).toBe("finished");
    expect(g.homeScore).toBe(1);
    expect(g.awayScore).toBe(3);
    expect(g.home).toEqual({ externalId: "10", name: "Hungary", logoUrl: null });
  });
  it("prefers the ft period score over the top-level (extra-time inclusive) score", () => {
    const g = normalizeOddsApiEvent({
      ...settled,
      scores: { home: 2, away: 1, periods: { ft: { home: 1, away: 1 } } },
    });
    expect(g.homeScore).toBe(1);
    expect(g.awayScore).toBe(1);
  });
  it("falls back to the top-level score when periods is missing", () => {
    const g = normalizeOddsApiEvent({
      ...settled,
      scores: { home: 2, away: 0 },
    });
    expect(g.homeScore).toBe(2);
    expect(g.awayScore).toBe(0);
  });
  it("maps pending to scheduled and ignores the {0,0} placeholder score", () => {
    const g = normalizeOddsApiEvent({
      ...settled,
      status: "pending",
      scores: { home: 0, away: 0 },
    });
    expect(g.status).toBe("scheduled");
    expect(g.homeScore).toBeNull();
    expect(g.awayScore).toBeNull();
  });
});

describe("selectOddsApiOdds", () => {
  const resp = {
    bookmakers: {
      Bet365: [{ name: "ML", odds: [{ home: "1.48", draw: "4.33", away: "6.50" }] }],
      TippmixPRO: [{ name: "ML", odds: [{ home: "1.46", draw: "4.20", away: "6.75" }] }],
    },
  };
  it("prefers TippmixPRO over Bet365", () => {
    expect(selectOddsApiOdds("1", resp)).toEqual({
      externalGameId: "1",
      homeOdds: "1.46",
      drawOdds: "4.20",
      awayOdds: "6.75",
    });
  });
  it("falls back to any bookmaker with an ML market", () => {
    expect(
      selectOddsApiOdds("1", {
        bookmakers: { Unibet: [{ name: "ML", odds: [{ home: "2.0", draw: "3.0", away: "3.0" }] }] },
      }),
    ).toEqual({ externalGameId: "1", homeOdds: "2.0", drawOdds: "3.0", awayOdds: "3.0" });
  });
  it("returns null when no ML market exists", () => {
    expect(
      selectOddsApiOdds("1", { bookmakers: { Bet365: [{ name: "Totals", odds: [] }] } }),
    ).toBeNull();
  });
  it("exposes the preferred bookmaker list (HU first)", () => {
    expect(ODDS_API_BOOKMAKERS).toEqual(["TippmixPRO", "Bet365"]);
  });
});
