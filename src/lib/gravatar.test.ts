import { describe, expect, it } from "vitest";
import { gravatarUrl } from "./gravatar";

const HASH = "84059b07d4be67b806386c0aad8070a23f18836bbaae342275dc0a83414c32ee";

describe("gravatarUrl", () => {
  it("a hash-t az útvonalba építi a gravatar.com-on", () => {
    expect(gravatarUrl(HASH, { size: 64 })).toContain(`https://www.gravatar.com/avatar/${HASH}`);
  });

  it("d=404-et állít, hogy hiányzó képnél 404 jöjjön (a lánc a monogramra essen)", () => {
    const url = new URL(gravatarUrl(HASH, { size: 64 }));
    expect(url.searchParams.get("d")).toBe("404");
  });

  it("a kért méretet s= paraméterként adja át", () => {
    const url = new URL(gravatarUrl(HASH, { size: 128 }));
    expect(url.searchParams.get("s")).toBe("128");
  });
});
