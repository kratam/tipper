import { afterEach, expect, it, vi } from "vitest";
import { getProvider } from "@/lib/providers";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
const cfg = {
  provider: "odds-api" as const,
  sport: "football",
  leagueSlug: "international-world-cup",
};

it("is registered", () => {
  expect(getProvider("odds-api").id).toBe("odds-api");
});

it("fetchFixtures normalizes events", async () => {
  vi.stubEnv("ODDS_API_KEY", "k");
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify([
            {
              id: 1,
              home: "Hungary",
              away: "Brazil",
              homeId: 10,
              awayId: 20,
              date: "2026-06-01T18:00:00Z",
              status: "pending",
              scores: { home: 0, away: 0 },
            },
          ]),
          { status: 200 },
        ),
    ),
  );
  const games = await getProvider("odds-api").fetchFixtures(cfg, ["hu", "en"]);
  expect(games[0].externalId).toBe("1");
  expect(games[0].home.name).toBe("Hungary");
});

it("fetchOdds fetches per-event odds for pending events", async () => {
  vi.stubEnv("ODDS_API_KEY", "k");
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(url);
      if (url.includes("/events"))
        return new Response(
          JSON.stringify([
            {
              id: 1,
              home: "Hungary",
              away: "Brazil",
              homeId: 10,
              awayId: 20,
              date: "2026-06-01T18:00:00Z",
              status: "pending",
              scores: { home: 0, away: 0 },
            },
            {
              id: 2,
              home: "Spain",
              away: "Japan",
              homeId: 30,
              awayId: 40,
              date: "2026-06-02T18:00:00Z",
              status: "settled",
              scores: { home: 1, away: 1 },
            },
          ]),
          { status: 200 },
        );
      return new Response(
        JSON.stringify({
          bookmakers: {
            TippmixPRO: [{ name: "ML", odds: [{ home: "1.46", draw: "4.20", away: "6.75" }] }],
          },
        }),
        { status: 200 },
      );
    }),
  );
  const odds = await getProvider("odds-api").fetchOdds(cfg);
  expect(odds).toEqual([
    { externalGameId: "1", homeOdds: "1.46", drawOdds: "4.20", awayOdds: "6.75" },
  ]);
  expect(calls.filter((u) => u.includes("/odds")).length).toBe(1); // csak a pending eseményre
});
