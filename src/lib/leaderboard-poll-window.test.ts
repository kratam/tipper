import { describe, expect, it } from "vitest";
import { inMatchWindow, POLL_LEAD_MS, POLL_WINDOW_MS } from "@/lib/leaderboard-poll-window";

const KICKOFF = 1_700_000_000_000; // tetszőleges fix epoch-ms

describe("inMatchWindow", () => {
  it("nincs meccs → soha nem pollozik", () => {
    expect(inMatchWindow([], KICKOFF)).toBe(false);
  });

  it("a kickoff pillanatában aktív", () => {
    expect(inMatchWindow([KICKOFF], KICKOFF)).toBe(true);
  });

  it("a lead-ablakon belül (kickoff előtt) aktív", () => {
    expect(inMatchWindow([KICKOFF], KICKOFF - POLL_LEAD_MS + 1)).toBe(true);
  });

  it("a lead-ablak előtt (túl korán) még nem aktív", () => {
    expect(inMatchWindow([KICKOFF], KICKOFF - POLL_LEAD_MS - 1)).toBe(false);
  });

  it("a meccs alatt / közvetlenül utána (ablakon belül) aktív", () => {
    expect(inMatchWindow([KICKOFF], KICKOFF + POLL_WINDOW_MS - 1)).toBe(true);
  });

  it("az ablak lejárta után leáll", () => {
    expect(inMatchWindow([KICKOFF], KICKOFF + POLL_WINDOW_MS + 1)).toBe(false);
  });

  it("több meccs közül elég, ha egy ablakban van", () => {
    const tomorrow = KICKOFF + 24 * 60 * 60 * 1000;
    expect(inMatchWindow([KICKOFF, tomorrow], KICKOFF + 60_000)).toBe(true);
  });

  it("két meccs közötti holtidőben nem pollozik", () => {
    const later = KICKOFF + 10 * 60 * 60 * 1000;
    const between = KICKOFF + POLL_WINDOW_MS + 60 * 60 * 1000; // ablakok között
    expect(inMatchWindow([KICKOFF, later], between)).toBe(false);
  });
});
