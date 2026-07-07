import { describe, expect, it } from "vitest";
import { computeBonusPoolLevel } from "./match-stats";

describe("computeBonusPoolLevel", () => {
  it("kikapcsolt bónusz (pct <= 0) → null", () => {
    expect(computeBonusPoolLevel(100000, 0, 3)).toBeNull();
    expect(computeBonusPoolLevel(100000, -1, 3)).toBeNull();
  });

  it("élő meccs (hitters null): csak a keret, egy főre eső nincs", () => {
    expect(computeBonusPoolLevel(100000, 2, null)).toEqual({
      pool: 2000,
      hitters: null,
      perHitter: null,
    });
  });

  it("lezárt meccs: keret + egy főre eső (floor, a scoringgal egyezik)", () => {
    // floor(100000 × 2 / 100) = 2000, floor(2000 / 3) = 666
    expect(computeBonusPoolLevel(100000, 2, 3)).toEqual({
      pool: 2000,
      hitters: 3,
      perHitter: 666,
    });
  });

  it("lezárt meccs 0 találóval: keret marad, egy főre eső 0", () => {
    expect(computeBonusPoolLevel(100000, 3, 0)).toEqual({
      pool: 3000,
      hitters: 0,
      perHitter: 0,
    });
  });

  it("negatív pool-alap → 0 keret", () => {
    expect(computeBonusPoolLevel(-500, 2, null)).toEqual({
      pool: 0,
      hitters: null,
      perHitter: null,
    });
  });
});
