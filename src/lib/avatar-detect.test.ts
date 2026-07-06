import { describe, expect, it } from "vitest";
import {
  dominantColorRatio,
  isGeneratedMonogram,
  MONOGRAM_DOMINANT_THRESHOLD,
  pickGoogleAvatarUrl,
} from "./avatar-detect";

describe("pickGoogleAvatarUrl", () => {
  const url = "https://lh3.googleusercontent.com/a/ACg8oc...";

  it("valódi képnél (true) megtartja a Google-képet", () => {
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

describe("dominantColorRatio", () => {
  it("egyszínű bufferre 1.0 (a teljes kép egy szín)", () => {
    const buf = Buffer.from([200, 30, 30, 200, 30, 30, 200, 30, 30]);
    expect(dominantColorRatio(buf, 3)).toBe(1);
  });

  it("fele-fele két színnél 0.5", () => {
    // 2 pixel piros, 2 pixel zöld (más kvant-vödör)
    const buf = Buffer.from([200, 0, 0, 200, 0, 0, 0, 200, 0, 0, 200, 0]);
    expect(dominantColorRatio(buf, 3)).toBe(0.5);
  });

  it("a közeli árnyalatokat egy vödörbe vonja (kvantálás)", () => {
    // 240 és 255 ugyanabba a 4-bites vödörbe esik (>>4 = 15) → 1 domináns
    const buf = Buffer.from([255, 0, 0, 240, 0, 0, 241, 0, 0]);
    expect(dominantColorRatio(buf, 3)).toBe(1);
  });

  it("kezeli a 4 csatornát (RGBA)", () => {
    const buf = Buffer.from([10, 20, 30, 255, 10, 20, 30, 128]);
    expect(dominantColorRatio(buf, 4)).toBe(1);
  });

  it("üres bufferre 0", () => {
    expect(dominantColorRatio(Buffer.from([]), 3)).toBe(0);
  });
});

describe("isGeneratedMonogram", () => {
  it("a mért monogramok (nagy domináns háttér) generáltak", () => {
    // prod: a monogramok domináns aránya 0.89–0.97
    expect(isGeneratedMonogram(0.89)).toBe(true);
    expect(isGeneratedMonogram(0.97)).toBe(true);
  });

  it("a feltöltött képek (fotó, fekete-fehér, rajz) NEM monogramok", () => {
    // prod: Kornél fekete-fehér fotó 0.77, Emma rajz 0.50, fényképek ≤0.27
    expect(isGeneratedMonogram(0.77)).toBe(false);
    expect(isGeneratedMonogram(0.5)).toBe(false);
    expect(isGeneratedMonogram(0.16)).toBe(false);
  });

  it("a küszöbön NEM, fölötte igen", () => {
    expect(isGeneratedMonogram(MONOGRAM_DOMINANT_THRESHOLD)).toBe(false);
    expect(isGeneratedMonogram(MONOGRAM_DOMINANT_THRESHOLD + 0.01)).toBe(true);
  });
});
