import { describe, expect, it } from "vitest";
import { getProvider } from "@/lib/providers";

describe("getProvider", () => {
  it("returns the api-sports provider", () => {
    expect(getProvider("api-sports").id).toBe("api-sports");
  });
  it("throws for an unknown provider", () => {
    // @ts-expect-error testing the runtime guard
    expect(() => getProvider("nope")).toThrow(/Unknown provider/);
  });
});
