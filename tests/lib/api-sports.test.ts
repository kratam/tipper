import { describe, expect, it } from "vitest";
import {
  extract3WayOdds,
  mapApiStatus,
  parsePeriodsString,
  parseRegulationScore,
} from "@/lib/api-sports";

describe("parsePeriodsString", () => {
  it("parses '2-1' to [2, 1]", () => {
    expect(parsePeriodsString("2-1")).toEqual([2, 1]);
  });
  it("returns [0, 0] for null", () => {
    expect(parsePeriodsString(null)).toEqual([0, 0]);
  });
});

describe("parseRegulationScore", () => {
  it("sums first three periods", () => {
    expect(
      parseRegulationScore({
        first: "2-1",
        second: "0-1",
        third: "1-0",
        overtime: "1-0",
        penalties: null,
      }),
    ).toEqual({ home: 3, away: 2 });
  });
  it("ignores overtime and penalties", () => {
    expect(
      parseRegulationScore({
        first: "1-1",
        second: "1-1",
        third: "0-0",
        overtime: "0-1",
        penalties: "2-3",
      }),
    ).toEqual({ home: 2, away: 2 });
  });
  it("handles null periods", () => {
    expect(
      parseRegulationScore({
        first: null,
        second: null,
        third: null,
        overtime: null,
        penalties: null,
      }),
    ).toEqual({ home: 0, away: 0 });
  });
});

describe("mapApiStatus", () => {
  it("maps NS to scheduled", () => {
    expect(mapApiStatus("NS")).toBe("scheduled");
  });
  it("maps FT to finished", () => {
    expect(mapApiStatus("FT")).toBe("finished");
  });
  it("maps AOT to finished", () => {
    expect(mapApiStatus("AOT")).toBe("finished");
  });
  it("maps AP to finished", () => {
    expect(mapApiStatus("AP")).toBe("finished");
  });
  it("maps CANC to cancelled", () => {
    expect(mapApiStatus("CANC")).toBe("cancelled");
  });
  it("maps POST to cancelled", () => {
    expect(mapApiStatus("POST")).toBe("cancelled");
  });
  it("maps P1 to live", () => {
    expect(mapApiStatus("P1")).toBe("live");
  });
  it("maps OT to live", () => {
    expect(mapApiStatus("OT")).toBe("live");
  });
});
