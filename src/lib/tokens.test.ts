import { describe, expect, it } from "vitest";
import { computeMatchesToDate } from "./tokens";

const utc = "UTC";
const d = (iso: string) => new Date(iso);

describe("computeMatchesToDate", () => {
  const tourney = [
    { scheduledAt: d("2026-07-01T18:00:00Z"), status: "finished" },
    { scheduledAt: d("2026-07-05T18:00:00Z"), status: "finished" },
    { scheduledAt: d("2026-07-06T18:00:00Z"), status: "live" }, // a cél-meccs napja
    { scheduledAt: d("2026-07-09T18:00:00Z"), status: "scheduled" },
  ];

  it("a cél-meccs dátumára vagy elé eső meccseket számolja (inkluzív)", () => {
    // 07-06-ig: 07-01, 07-05, 07-06 → 3
    expect(computeMatchesToDate(tourney, utc, 20260706)).toBe(3);
  });

  it("a törölt meccseket kihagyja", () => {
    const withCancelled = [
      ...tourney,
      { scheduledAt: d("2026-07-03T18:00:00Z"), status: "cancelled" },
    ];
    expect(computeMatchesToDate(withCancelled, utc, 20260706)).toBe(3);
  });

  it("a cél-dátum utáni meccsek nem számítanak", () => {
    // 07-05-ig: 07-01, 07-05 → 2 (a 07-06 és 07-09 kimarad)
    expect(computeMatchesToDate(tourney, utc, 20260705)).toBe(2);
  });

  it("időzóna szerint sorolja a nap-határon lévő meccset", () => {
    // 07-06T23:00Z Budapesten (UTC+2) már 07-07 → a 07-06-i cél-dátumnak nem <=
    const late = [{ scheduledAt: d("2026-07-06T23:00:00Z"), status: "finished" }];
    expect(computeMatchesToDate(late, "Europe/Budapest", 20260706)).toBe(0);
    expect(computeMatchesToDate(late, utc, 20260706)).toBe(1);
  });
});
