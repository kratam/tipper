import { describe, expect, it } from "vitest";
import { gravatarHash } from "./gravatar-hash";

describe("gravatarHash", () => {
  it("a Gravatar dokumentált SHA-256 vektorát adja", () => {
    // https://docs.gravatar.com/api/avatars/hash/
    expect(gravatarHash("MyEmailAddress@example.com")).toBe(
      "84059b07d4be67b806386c0aad8070a23f18836bbaae342275dc0a83414c32ee",
    );
  });

  it("normalizál: körülvevő whitespace-t vág és kisbetűsít", () => {
    expect(gravatarHash("  MyEmailAddress@Example.COM  ")).toBe(
      gravatarHash("myemailaddress@example.com"),
    );
  });

  it("64 karakteres hex stringet ad", () => {
    const hash = gravatarHash("valaki@pelda.hu");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("üres emailre null", () => {
    expect(gravatarHash("")).toBeNull();
  });

  it("csak whitespace emailre null", () => {
    expect(gravatarHash("   ")).toBeNull();
  });

  it("null / undefined emailre null", () => {
    expect(gravatarHash(null)).toBeNull();
    expect(gravatarHash(undefined)).toBeNull();
  });
});
