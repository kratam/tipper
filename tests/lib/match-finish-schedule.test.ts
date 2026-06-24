import { describe, expect, it } from "vitest";
import {
  computeNextFinishCheck,
  delaySecondsUntil,
  type PendingMatch,
  RECHECK_INTERVAL_MS,
} from "@/lib/match-finish-schedule";

const FOOTBALL = 115 * 60 * 1000; // 1h55m
const NOW = new Date("2026-06-23T20:00:00.000Z");

function match(scheduledAt: string, status: "scheduled" | "live" = "scheduled"): PendingMatch {
  return { scheduledAt: new Date(scheduledAt), status, durationMs: FOOTBALL };
}

describe("computeNextFinishCheck", () => {
  it("üres pending → null (a lánc leáll)", () => {
    expect(computeNextFinishCheck([], NOW)).toBeNull();
  });

  it("minden meccs a jövőben fejeződik be → a legkorábbi várható vég", () => {
    // 19:00 kezdés → vége 20:55; 22:00 kezdés → vége 23:55
    const result = computeNextFinishCheck(
      [match("2026-06-23T22:00:00Z"), match("2026-06-23T19:00:00Z")],
      NOW,
    );
    expect(result).toEqual(new Date("2026-06-23T20:55:00.000Z"));
  });

  it("van lejárt várható végű (még nem finished) meccs → now + RECHECK_INTERVAL", () => {
    // 17:55 kezdés → vége 19:50, ami < NOW(20:00) → overdue
    const result = computeNextFinishCheck([match("2026-06-23T17:55:00Z")], NOW);
    expect(result).toEqual(new Date(NOW.getTime() + RECHECK_INTERVAL_MS));
  });

  it("live meccs a várható vég ELŐTT → a várható vég (nem recheck még)", () => {
    // 19:30 kezdés, live → vége 21:25 > NOW → nem overdue
    const result = computeNextFinishCheck([match("2026-06-23T19:30:00Z", "live")], NOW);
    expect(result).toEqual(new Date("2026-06-23T21:25:00.000Z"));
  });

  it("live meccs a várható vég UTÁN → now + RECHECK_INTERVAL", () => {
    // 18:00 kezdés, live → vége 19:55 < NOW → overdue
    const result = computeNextFinishCheck([match("2026-06-23T18:00:00Z", "live")], NOW);
    expect(result).toEqual(new Date(NOW.getTime() + RECHECK_INTERVAL_MS));
  });

  it("vegyes: egy overdue + egy jövőbeli → az overdue nyer (recheck)", () => {
    const result = computeNextFinishCheck(
      [match("2026-06-23T17:55:00Z"), match("2026-06-23T22:00:00Z")],
      NOW,
    );
    expect(result).toEqual(new Date(NOW.getTime() + RECHECK_INTERVAL_MS));
  });
});

describe("RECHECK_INTERVAL_MS", () => {
  it("1 perc — sűrű recheck a meccs vége felé (gyors pontozás)", () => {
    expect(RECHECK_INTERVAL_MS).toBe(60_000);
  });
});

describe("delaySecondsUntil", () => {
  it("jövőbeli cél → másodpercek felfelé kerekítve", () => {
    expect(delaySecondsUntil(new Date("2026-06-23T20:10:30Z"), NOW)).toBe(630);
  });

  it("közeli/múltbeli cél → minimum 60 másodperc padló", () => {
    expect(delaySecondsUntil(new Date("2026-06-23T20:00:10Z"), NOW)).toBe(60);
    expect(delaySecondsUntil(new Date("2026-06-23T19:00:00Z"), NOW)).toBe(60);
  });
});
