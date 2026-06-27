import { describe, expect, it } from "vitest";
import { getInitials } from "./initials";

describe("getInitials", () => {
  it("két szóból a két kezdőbetűt adja, nagybetűsen", () => {
    expect(getInitials("Tamas Krasser")).toBe("TK");
  });

  it("egy szóból egy betűt ad", () => {
    expect(getInitials("Tippmester")).toBe("T");
  });

  it("legfeljebb két betűt ad, akkor is ha több szó van", () => {
    expect(getInitials("Nagy János Béla")).toBe("NJ");
  });

  it("a megjelenített (display) névből számol, nem karakter-prefixből", () => {
    // bet-row korábbi slice(0,2) hibája: "Tamas Krasser" -> "TA" lett volna
    expect(getInitials("Tamas Krasser")).not.toBe("TA");
  });

  it("kezeli a több egymást követő szóközt", () => {
    expect(getInitials("Nagy   János")).toBe("NJ");
  });

  it("levágja a körülvevő whitespace-t", () => {
    expect(getInitials("  Anna  ")).toBe("A");
  });

  it("kisbetűs nevet nagybetűsít", () => {
    expect(getInitials("anna kis")).toBe("AK");
  });

  it("üres stringre üres stringet ad", () => {
    expect(getInitials("")).toBe("");
  });

  it("csak whitespace-re üres stringet ad", () => {
    expect(getInitials("   ")).toBe("");
  });

  it("kezeli az ékezetes kezdőbetűt", () => {
    expect(getInitials("Ágnes Örs")).toBe("ÁÖ");
  });
});
