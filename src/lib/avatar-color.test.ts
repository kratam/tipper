import { describe, expect, it } from "vitest";
import { AVATAR_COLOR_COUNT, avatarColorIndex } from "./avatar-color";

describe("avatarColorIndex", () => {
  it("determinisztikus: ugyanaz a név mindig ugyanazt az indexet adja", () => {
    expect(avatarColorIndex("Andris")).toBe(avatarColorIndex("Andris"));
  });

  it("a paletta tartományában marad (0 .. AVATAR_COLOR_COUNT-1)", () => {
    const names = ["Andris", "Tamas Krasser", "Csiszi", "Bence", "Dóra", "M", "", "  "];
    for (const name of names) {
      const idx = avatarColorIndex(name);
      expect(Number.isInteger(idx)).toBe(true);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(AVATAR_COLOR_COUNT);
    }
  });

  it("nem konstans: különböző nevek nem mind ugyanazt az indexet kapják", () => {
    const indices = new Set(
      ["Andris", "Bence", "Dóra", "Csiszi", "Márk", "Nóra", "Peti", "Zsófi"].map(avatarColorIndex),
    );
    expect(indices.size).toBeGreaterThan(1);
  });

  it("üres névre sem dob, valid indexet ad", () => {
    expect(() => avatarColorIndex("")).not.toThrow();
    expect(avatarColorIndex("")).toBeGreaterThanOrEqual(0);
    expect(avatarColorIndex("")).toBeLessThan(AVATAR_COLOR_COUNT);
  });

  it("ékezetes nevet determinisztikusan kezel", () => {
    expect(avatarColorIndex("Ágnes")).toBe(avatarColorIndex("Ágnes"));
  });
});
