import { describe, expect, it } from "vitest";
import { formatEffectiveOdds } from "./odds-display";

describe("formatEffectiveOdds", () => {
  it("returns null when oddsAtBet is null", () => {
    expect(formatEffectiveOdds(null, 1.15)).toBeNull();
  });

  it("returns the raw odds unchanged when boost is 1.0", () => {
    expect(formatEffectiveOdds("1.55", 1.0)).toBe("1.55");
  });

  it("multiplies odds by boost and rounds to 2 decimals", () => {
    // 1.48 × 1.15 = 1.702 → "1.70"
    expect(formatEffectiveOdds("1.48", 1.15)).toBe("1.70");
  });

  it("rounds half up at the 2nd decimal", () => {
    // 2.00 × 1.125 = 2.25 → "2.25"
    expect(formatEffectiveOdds("2.00", 1.125)).toBe("2.25");
  });

  it("formats whole results with trailing zeros", () => {
    // 2.00 × 1.00 = 2.00 → "2.00"
    expect(formatEffectiveOdds("2.00", 1.0)).toBe("2.00");
  });
});
