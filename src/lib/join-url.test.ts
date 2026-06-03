import { describe, expect, it } from "vitest";
import { buildJoinCallbackUrl } from "./join-url";

describe("buildJoinCallbackUrl", () => {
  it("omits the prefix for the default locale (hu)", () => {
    expect(buildJoinCallbackUrl("hu", "4V8M35")).toBe("/join/4V8M35");
  });

  it("prefixes non-default locales", () => {
    expect(buildJoinCallbackUrl("en", "4V8M35")).toBe("/en/join/4V8M35");
  });
});
