import { describe, expect, it } from "vitest";
import { buildJoinCallbackUrl, localizePath } from "./join-url";

describe("buildJoinCallbackUrl", () => {
  it("omits the prefix for the default locale (hu)", () => {
    expect(buildJoinCallbackUrl("hu", "4V8M35")).toBe("/join/4V8M35");
  });

  it("prefixes non-default locales", () => {
    expect(buildJoinCallbackUrl("en", "4V8M35")).toBe("/en/join/4V8M35");
  });
});

describe("localizePath", () => {
  it("omits the prefix for the default locale (hu)", () => {
    expect(localizePath("hu", "/tournaments")).toBe("/tournaments");
    expect(localizePath("hu", "/circles")).toBe("/circles");
  });

  it("prefixes non-default locales", () => {
    expect(localizePath("en", "/tournaments")).toBe("/en/tournaments");
    expect(localizePath("en", "/circles")).toBe("/en/circles");
  });
});
