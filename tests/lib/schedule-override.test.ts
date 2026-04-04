import { describe, expect, it } from "vitest";
import { hasApiScheduleImproved, isScheduleBroken } from "@/lib/schedule-override";

describe("isScheduleBroken", () => {
  it("returns true when >80% fall on same day (10/10 on same day)", () => {
    const dates = Array.from(
      { length: 10 },
      (_, i) => new Date(`2026-04-10T${String(10 + i).padStart(2, "0")}:00:00Z`),
    );
    expect(isScheduleBroken(dates)).toBe(true);
  });

  it("returns true at 81.8% (9/11 on same day)", () => {
    const sameDayDates = Array.from(
      { length: 9 },
      (_, i) => new Date(`2026-04-10T${String(10 + i).padStart(2, "0")}:00:00Z`),
    );
    const otherDates = [new Date("2026-04-11T14:00:00Z"), new Date("2026-04-12T14:00:00Z")];
    expect(isScheduleBroken([...sameDayDates, ...otherDates])).toBe(true);
  });

  it("returns false when dates are spread (2/5 max on one day = 40%)", () => {
    const dates = [
      new Date("2026-04-10T14:00:00Z"),
      new Date("2026-04-10T18:00:00Z"),
      new Date("2026-04-11T14:00:00Z"),
      new Date("2026-04-12T14:00:00Z"),
      new Date("2026-04-13T14:00:00Z"),
    ];
    expect(isScheduleBroken(dates)).toBe(false);
  });

  it("returns false for empty array", () => {
    expect(isScheduleBroken([])).toBe(false);
  });

  it("returns false for single match", () => {
    expect(isScheduleBroken([new Date("2026-04-10T14:00:00Z")])).toBe(false);
  });

  it("groups by UTC date correctly across midnight (same day, different hours)", () => {
    const dates = [
      new Date("2026-04-10T00:00:00Z"),
      new Date("2026-04-10T23:59:59Z"),
      new Date("2026-04-11T00:00:01Z"),
    ];
    // 2/3 = 66.7% on April 10 — not > 80%
    expect(isScheduleBroken(dates)).toBe(false);
  });
});

describe("hasApiScheduleImproved", () => {
  it("returns true when 100% match within 2h", () => {
    const pairs = [
      {
        apiDate: new Date("2026-04-10T14:00:00Z"),
        overrideDate: new Date("2026-04-10T15:00:00Z"),
      },
      {
        apiDate: new Date("2026-04-11T14:00:00Z"),
        overrideDate: new Date("2026-04-11T14:30:00Z"),
      },
    ];
    expect(hasApiScheduleImproved(pairs)).toBe(true);
  });

  it("returns false when API still has placeholder dates (0% match)", () => {
    const pairs = [
      {
        apiDate: new Date("2026-04-10T00:00:00Z"),
        overrideDate: new Date("2026-04-10T18:00:00Z"),
      },
      {
        apiDate: new Date("2026-04-11T00:00:00Z"),
        overrideDate: new Date("2026-04-11T20:00:00Z"),
      },
    ];
    expect(hasApiScheduleImproved(pairs)).toBe(false);
  });

  it("returns true at exactly 90% (9/10 match)", () => {
    const matching = Array.from({ length: 9 }, (_, i) => ({
      apiDate: new Date(`2026-04-${String(10 + i).padStart(2, "0")}T14:00:00Z`),
      overrideDate: new Date(`2026-04-${String(10 + i).padStart(2, "0")}T15:00:00Z`),
    }));
    const nonMatching = [
      {
        apiDate: new Date("2026-04-20T00:00:00Z"),
        overrideDate: new Date("2026-04-20T18:00:00Z"),
      },
    ];
    expect(hasApiScheduleImproved([...matching, ...nonMatching])).toBe(true);
  });

  it("returns false at 80% (8/10 match)", () => {
    const matching = Array.from({ length: 8 }, (_, i) => ({
      apiDate: new Date(`2026-04-${String(10 + i).padStart(2, "0")}T14:00:00Z`),
      overrideDate: new Date(`2026-04-${String(10 + i).padStart(2, "0")}T15:00:00Z`),
    }));
    const nonMatching = Array.from({ length: 2 }, (_, i) => ({
      apiDate: new Date(`2026-04-${String(20 + i).padStart(2, "0")}T00:00:00Z`),
      overrideDate: new Date(`2026-04-${String(20 + i).padStart(2, "0")}T18:00:00Z`),
    }));
    expect(hasApiScheduleImproved([...matching, ...nonMatching])).toBe(false);
  });

  it("exactly +/-2h boundary counts as matching", () => {
    const pairs = [
      {
        apiDate: new Date("2026-04-10T14:00:00Z"),
        overrideDate: new Date("2026-04-10T16:00:00Z"), // exactly +2h
      },
      {
        apiDate: new Date("2026-04-11T14:00:00Z"),
        overrideDate: new Date("2026-04-11T12:00:00Z"), // exactly -2h
      },
    ];
    expect(hasApiScheduleImproved(pairs)).toBe(true);
  });

  it(">2h (2h + 1s) does NOT match", () => {
    const pairs = [
      {
        apiDate: new Date("2026-04-10T14:00:00Z"),
        overrideDate: new Date("2026-04-10T16:00:01Z"), // 2h + 1s
      },
    ];
    expect(hasApiScheduleImproved(pairs)).toBe(false);
  });

  it("returns false for empty pairs", () => {
    expect(hasApiScheduleImproved([])).toBe(false);
  });
});
