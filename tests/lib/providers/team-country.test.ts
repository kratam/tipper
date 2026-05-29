import { describe, expect, it } from "vitest";
import { countryCodeFromName, resolveCountryDisplay } from "@/lib/providers/team-country";

describe("countryCodeFromName", () => {
  it("maps standard English country names", () => {
    expect(countryCodeFromName("Hungary")).toBe("HU");
    expect(countryCodeFromName("Brazil")).toBe("BR");
    expect(countryCodeFromName("Czechia")).toBe("CZ");
  });
  it("maps Hungarian country names", () => {
    expect(countryCodeFromName("Magyarország")).toBe("HU");
  });
  it("applies World Cup name aliases", () => {
    expect(countryCodeFromName("Korea Republic")).toBe("KR");
    expect(countryCodeFromName("USA")).toBe("US");
    expect(countryCodeFromName("Bosnia and Herzegovina")).toBe("BA");
  });
  it("returns null for non-country names", () => {
    expect(countryCodeFromName("Manchester United")).toBeNull();
    expect(countryCodeFromName(null)).toBeNull();
  });
});

describe("resolveCountryDisplay", () => {
  it("returns localized name + flag url for a country", () => {
    expect(resolveCountryDisplay("Hungary", "hu")).toEqual({
      name: "Magyarország",
      flagUrl: "https://flagcdn.com/w80/hu.png",
    });
    expect(resolveCountryDisplay("Hungary", "en")).toEqual({
      name: "Hungary",
      flagUrl: "https://flagcdn.com/w80/hu.png",
    });
  });
  it("returns null for a non-country", () => {
    expect(resolveCountryDisplay("Manchester United", "hu")).toBeNull();
  });
});
