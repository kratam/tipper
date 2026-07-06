import { describe, expect, it } from "vitest";
import {
  countUniqueColors,
  isLikelyRealPhoto,
  pickGoogleAvatarUrl,
  REAL_PHOTO_COLOR_THRESHOLD,
} from "./avatar-detect";

describe("pickGoogleAvatarUrl", () => {
  const url = "https://lh3.googleusercontent.com/a/ACg8oc...";

  it("valódi fotónál (true) megtartja a Google-képet", () => {
    expect(pickGoogleAvatarUrl(url, true)).toBe(url);
  });

  it("bizonyítottan generáltnál (false) elrejti a Google-képet", () => {
    expect(pickGoogleAvatarUrl(url, false)).toBeNull();
  });

  it("még nem detektáltnál (null) konzervatívan megtartja a Google-képet", () => {
    expect(pickGoogleAvatarUrl(url, null)).toBe(url);
  });

  it("nincs avatarUrl → null marad", () => {
    expect(pickGoogleAvatarUrl(null, false)).toBeNull();
    expect(pickGoogleAvatarUrl(null, true)).toBeNull();
  });
});

describe("countUniqueColors", () => {
  it("egyszínű bufferre 1-et ad (3 csatorna)", () => {
    const buf = Buffer.from([255, 0, 0, 255, 0, 0, 255, 0, 0]);
    expect(countUniqueColors(buf, 3)).toBe(1);
  });

  it("két különböző színt megszámol", () => {
    const buf = Buffer.from([255, 0, 0, 0, 255, 0]);
    expect(countUniqueColors(buf, 3)).toBe(2);
  });

  it("ismétlődő színeket egyszer számol", () => {
    const buf = Buffer.from([1, 2, 3, 1, 2, 3, 9, 9, 9, 1, 2, 3]);
    expect(countUniqueColors(buf, 3)).toBe(2);
  });

  it("kezeli a 4 csatornát (RGBA) — az alfát figyelmen kívül hagyja a színnél", () => {
    // két pixel, azonos RGB, eltérő alfa → 1 szín
    const buf = Buffer.from([10, 20, 30, 255, 10, 20, 30, 128]);
    expect(countUniqueColors(buf, 4)).toBe(1);
  });

  it("üres bufferre 0", () => {
    expect(countUniqueColors(Buffer.from([]), 3)).toBe(0);
  });
});

describe("isLikelyRealPhoto", () => {
  it("a mért generált monogramok (kevés szín) NEM valódi fotók", () => {
    // Andris=62, Attila=111 — a userbázis mért generált avatarjai
    expect(isLikelyRealPhoto(62)).toBe(false);
    expect(isLikelyRealPhoto(111)).toBe(false);
  });

  it("a mért valódi fotók (sok szín) valódiak", () => {
    // György=4620, Mominho=6554 — mért valódi fotók
    expect(isLikelyRealPhoto(4620)).toBe(true);
    expect(isLikelyRealPhoto(6554)).toBe(true);
  });

  it("a küszöb alatt NEM valódi, a küszöbön/felette valódi", () => {
    expect(isLikelyRealPhoto(REAL_PHOTO_COLOR_THRESHOLD - 1)).toBe(false);
    expect(isLikelyRealPhoto(REAL_PHOTO_COLOR_THRESHOLD)).toBe(true);
  });
});
