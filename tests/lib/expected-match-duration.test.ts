import { describe, expect, it } from "vitest";
import { expectedMatchDurationMs } from "@/lib/match-duration";

const MIN = 60 * 1000;

describe("expectedMatchDurationMs", () => {
  it("football → 1h55m", () => {
    expect(expectedMatchDurationMs("football")).toBe(115 * MIN);
  });

  it("hockey (api-sports providerSport NULL) → 2h30m default", () => {
    expect(expectedMatchDurationMs(null)).toBe(150 * MIN);
  });

  it("unknown sport → 2h30m default", () => {
    expect(expectedMatchDurationMs("basketball")).toBe(150 * MIN);
  });
});
