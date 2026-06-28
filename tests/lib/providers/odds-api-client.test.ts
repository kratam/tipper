import { afterEach, expect, it, vi } from "vitest";
import { createOddsApiClient, ODDS_API_MAX_ATTEMPTS } from "@/lib/providers/odds-api/client";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it("fetches events for a league", async () => {
  vi.stubEnv("ODDS_API_KEY", "k");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      expect(url).toContain("/v3/events");
      expect(url).toContain("sport=football");
      expect(url).toContain("league=international-world-cup");
      expect(url).toContain("apiKey=k");
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
        ]),
        { status: 200 },
      );
    }),
  );
  const events = await createOddsApiClient().fetchEvents("football", "international-world-cup");
  expect(events[0].id).toBe(1);
});

it("requests odds with the bookmakers param", async () => {
  vi.stubEnv("ODDS_API_KEY", "k");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      expect(url).toContain("/v3/odds");
      expect(url).toContain("eventId=1");
      expect(url).toContain("bookmakers=TippmixPRO%2CBet365");
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
  const resp = await createOddsApiClient().fetchEventOdds(1, ["TippmixPRO", "Bet365"]);
  expect(resp.bookmakers.TippmixPRO[0].name).toBe("ML");
});

it("requests multi-event odds with comma-separated eventIds", async () => {
  vi.stubEnv("ODDS_API_KEY", "k");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      expect(url).toContain("/v3/odds/multi");
      expect(url).toContain("eventIds=1%2C2%2C3");
      expect(url).toContain("bookmakers=TippmixPRO%2CBet365");
      return new Response(
        JSON.stringify([
          {
            id: 1,
            bookmakers: {
              TippmixPRO: [{ name: "ML", odds: [{ home: "1.46", draw: "4.20", away: "6.75" }] }],
            },
          },
        ]),
        { status: 200 },
      );
    }),
  );
  const resp = await createOddsApiClient().fetchMultiEventOdds([1, 2, 3], ["TippmixPRO", "Bet365"]);
  expect(resp[0].id).toBe(1);
  expect(resp[0].bookmakers.TippmixPRO[0].name).toBe("ML");
});

it("throws when ODDS_API_KEY is missing", () => {
  expect(() => createOddsApiClient()).toThrow(/ODDS_API_KEY/);
});

// Az odds-api rendszeresen 500 "Failed to fetch events"-et ad terhelés alatt
// (a foci-VB lekérés ~7 próbából 1-szer jött be). Egyetlen 500 ne hasalassza el
// a sync-et — de CSAK az 500 átmeneti, a 4xx (404 League not found, 401) végleges.
it("retries on HTTP 500, then succeeds", async () => {
  vi.stubEnv("ODDS_API_KEY", "k");
  let calls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      calls++;
      if (calls < 3) {
        return new Response(JSON.stringify({ error: "Failed to fetch events" }), { status: 500 });
      }
      return new Response(JSON.stringify([{ id: 7 }]), { status: 200 });
    }),
  );
  const events = await createOddsApiClient({ retryBaseDelayMs: 0 }).fetchEvents(
    "football",
    "international-fifa-world-cup",
  );
  expect(calls).toBe(3);
  expect(events[0].id).toBe(7);
});

it("does NOT retry on HTTP 404 (League not found)", async () => {
  vi.stubEnv("ODDS_API_KEY", "k");
  let calls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      calls++;
      return new Response(JSON.stringify({ error: "League not found" }), { status: 404 });
    }),
  );
  await expect(
    createOddsApiClient({ retryBaseDelayMs: 0 }).fetchEvents("football", "nope"),
  ).rejects.toThrow(/404/);
  expect(calls).toBe(1);
});

it("stops retrying after the attempt cap on persistent 500", async () => {
  vi.stubEnv("ODDS_API_KEY", "k");
  let calls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      calls++;
      return new Response(JSON.stringify({ error: "Failed to fetch events" }), { status: 500 });
    }),
  );
  await expect(
    createOddsApiClient({ retryBaseDelayMs: 0 }).fetchEvents("football", "wc"),
  ).rejects.toThrow(/500/);
  expect(calls).toBe(ODDS_API_MAX_ATTEMPTS);
});
