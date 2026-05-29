import { describe, expect, it } from "vitest";
import type { ApiGame, ApiOddsGame } from "@/lib/api-sports";
import { normalizeApiGame, normalizeApiOdds } from "@/lib/providers/api-sports";

const baseGame: ApiGame = {
  id: 42,
  date: "2026-05-01T18:00:00+00:00",
  status: { short: "FT" },
  teams: {
    home: { id: 1, name: "Canada", logo: "https://logo/1.png" },
    away: { id: 2, name: "Czechia", logo: "https://logo/2.png" },
  },
  scores: { home: 5, away: 4 },
  periods: { first: "1-1", second: "1-2", third: "1-0", overtime: "2-1", penalties: null },
};

describe("normalizeApiGame", () => {
  it("uses regulation score for finished games and the provider name", () => {
    const g = normalizeApiGame(baseGame);
    expect(g.externalId).toBe("42");
    expect(g.status).toBe("finished");
    expect(g.homeScore).toBe(3); // 1+1+1 regulation, OT excluded
    expect(g.awayScore).toBe(3); // 1+2+0
    expect(g.home).toEqual({ externalId: "1", name: "Canada", logoUrl: "https://logo/1.png" });
  });
  it("uses raw scores for non-finished games", () => {
    const g = normalizeApiGame({
      ...baseGame,
      status: { short: "NS" },
      scores: { home: null, away: null },
    });
    expect(g.status).toBe("scheduled");
    expect(g.homeScore).toBeNull();
  });
});

describe("normalizeApiOdds", () => {
  it("maps a 3Way bookmaker bet into NormalizedOdds", () => {
    const oddsGame: ApiOddsGame = {
      game: { id: 42 },
      bookmakers: [
        {
          id: 1,
          name: "Bet365",
          bets: [
            {
              id: 1,
              name: "3Way Result",
              values: [
                { value: "Home", odd: "1.50" },
                { value: "Draw", odd: "4.20" },
                { value: "Away", odd: "5.00" },
              ],
            },
          ],
        },
      ],
    };
    expect(normalizeApiOdds(oddsGame)).toEqual({
      externalGameId: "42",
      homeOdds: "1.50",
      drawOdds: "4.20",
      awayOdds: "5.00",
    });
  });
  it("returns null when no 3-way odds present", () => {
    expect(normalizeApiOdds({ game: { id: 7 }, bookmakers: [] })).toBeNull();
  });
});
