import { describe, expect, it } from "vitest";
import { isReservedOfficialSlug, RESERVED_OFFICIAL_SLUGS } from "@/lib/official-group";

describe("isReservedOfficialSlug", () => {
  it("returns true for 'hivatalos'", () => {
    expect(isReservedOfficialSlug("hivatalos")).toBe(true);
  });
  it("returns true for 'official'", () => {
    expect(isReservedOfficialSlug("official")).toBe(true);
  });
  it("returns false for 'hivatalos-vip'", () => {
    expect(isReservedOfficialSlug("hivatalos-vip")).toBe(false);
  });
  it("returns false for 'my-group'", () => {
    expect(isReservedOfficialSlug("my-group")).toBe(false);
  });
  it("returns false for empty string", () => {
    expect(isReservedOfficialSlug("")).toBe(false);
  });
  it("returns true for 'ranglista'", () => {
    expect(isReservedOfficialSlug("ranglista")).toBe(true);
  });
  it("RESERVED_OFFICIAL_SLUGS contains all reserved values", () => {
    expect(RESERVED_OFFICIAL_SLUGS).toContain("hivatalos");
    expect(RESERVED_OFFICIAL_SLUGS).toContain("official");
    expect(RESERVED_OFFICIAL_SLUGS).toContain("ranglista");
  });
});
