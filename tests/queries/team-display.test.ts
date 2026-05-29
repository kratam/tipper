import { describe, expect, it } from "vitest";
import { withMatchTeamDisplay, withTeamDisplay } from "@/queries/team-display";

describe("withTeamDisplay", () => {
  it("returns the team unchanged when useFlagFallback=false", () => {
    const team = { name: "Hungary", logoUrl: null };
    const result = withTeamDisplay(team, "hu", false);
    expect(result).toEqual({ name: "Hungary", logoUrl: null });
  });

  it("localizes the country name and fills the flag when logoUrl is null", () => {
    const team = { name: "Hungary", logoUrl: null };
    const result = withTeamDisplay(team, "hu", true);
    expect(result.name).toBe("Magyarország");
    expect(result.logoUrl).toBe("https://flagcdn.com/w80/hu.png");
  });

  it("localizes the country name and fills the flag for the en locale", () => {
    const result = withTeamDisplay({ name: "Hungary", logoUrl: null }, "en", true);
    expect(result.name).toBe("Hungary");
    expect(result.logoUrl).toBe("https://flagcdn.com/w80/hu.png");
  });

  it("preserves an existing logoUrl and only localizes the name", () => {
    const team = { name: "Hungary", logoUrl: "https://example.com/hun.png" };
    const result = withTeamDisplay(team, "hu", true);
    expect(result.name).toBe("Magyarország");
    expect(result.logoUrl).toBe("https://example.com/hun.png");
  });

  it("returns a non-country name unchanged even with useFlagFallback=true", () => {
    const team = { name: "Manchester United", logoUrl: null };
    const result = withTeamDisplay(team, "hu", true);
    expect(result).toEqual({ name: "Manchester United", logoUrl: null });
  });
});

describe("withMatchTeamDisplay", () => {
  it("maps both home and away teams", () => {
    const match = {
      id: "m1",
      homeTeam: { name: "Hungary", logoUrl: null },
      awayTeam: { name: "Germany", logoUrl: null },
    };
    const result = withMatchTeamDisplay(match, "hu", true);
    expect(result.id).toBe("m1");
    expect(result.homeTeam.name).toBe("Magyarország");
    expect(result.homeTeam.logoUrl).toBe("https://flagcdn.com/w80/hu.png");
    expect(result.awayTeam.name).toBe("Németország");
    expect(result.awayTeam.logoUrl).toBe("https://flagcdn.com/w80/de.png");
  });
});
