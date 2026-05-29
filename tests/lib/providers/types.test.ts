import { describe, expect, it } from "vitest";
import { toProviderConfig } from "@/lib/providers/types";

describe("toProviderConfig", () => {
  it("builds an api-sports config", () => {
    expect(
      toProviderConfig({
        provider: "api-sports",
        apiLeagueId: 57,
        apiSeason: 2026,
        providerSport: null,
        providerLeagueSlug: null,
      }),
    ).toEqual({ provider: "api-sports", leagueId: 57, season: 2026 });
  });
  it("builds an odds-api config", () => {
    expect(
      toProviderConfig({
        provider: "odds-api",
        apiLeagueId: null,
        apiSeason: null,
        providerSport: "football",
        providerLeagueSlug: "international-world-cup",
      }),
    ).toEqual({ provider: "odds-api", sport: "football", leagueSlug: "international-world-cup" });
  });
  it("throws when api-sports columns missing", () => {
    expect(() =>
      toProviderConfig({
        provider: "api-sports",
        apiLeagueId: null,
        apiSeason: null,
        providerSport: null,
        providerLeagueSlug: null,
      }),
    ).toThrow(/api-sports/);
  });
  it("throws when odds-api columns missing", () => {
    expect(() =>
      toProviderConfig({
        provider: "odds-api",
        apiLeagueId: null,
        apiSeason: null,
        providerSport: null,
        providerLeagueSlug: null,
      }),
    ).toThrow(/odds-api/);
  });
});
