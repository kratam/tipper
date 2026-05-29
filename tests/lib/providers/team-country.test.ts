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
    expect(countryCodeFromName("Turkiye")).toBe("TR");
    expect(countryCodeFromName("IR Iran")).toBe("IR");
    expect(countryCodeFromName("Congo DR")).toBe("CD");
    expect(countryCodeFromName("Curacao")).toBe("CW");
  });
  it("returns null for non-country names", () => {
    expect(countryCodeFromName("Manchester United")).toBeNull();
    expect(countryCodeFromName(null)).toBeNull();
  });
});

describe("resolveCountryDisplay — UK home nations (non-ISO regions)", () => {
  it("maps Scotland to its subdivision flag + localized name", () => {
    expect(resolveCountryDisplay("Scotland", "hu")).toEqual({
      name: "Skócia",
      flagUrl: "https://flagcdn.com/w80/gb-sct.png",
    });
    expect(resolveCountryDisplay("Scotland", "en")).toEqual({
      name: "Scotland",
      flagUrl: "https://flagcdn.com/w80/gb-sct.png",
    });
  });
  it("maps England to its subdivision flag", () => {
    expect(resolveCountryDisplay("England", "hu")).toEqual({
      name: "Anglia",
      flagUrl: "https://flagcdn.com/w80/gb-eng.png",
    });
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
