import { describe, expect, it } from "vitest";
import {
  decideInviteAction,
  extractInviteCodeFromPath,
  PENDING_INVITE_COOKIE,
  PENDING_INVITE_MAX_AGE_SECONDS,
} from "./pending-invite";

describe("extractInviteCodeFromPath", () => {
  it("matches the default-locale path", () => {
    expect(extractInviteCodeFromPath("/join/4V8M35")).toBe("4V8M35");
  });

  it("matches locale-prefixed paths", () => {
    expect(extractInviteCodeFromPath("/hu/join/4V8M35")).toBe("4V8M35");
    expect(extractInviteCodeFromPath("/en/join/ABC123")).toBe("ABC123");
  });

  it("tolerates a trailing slash", () => {
    expect(extractInviteCodeFromPath("/join/4V8M35/")).toBe("4V8M35");
  });

  it("returns null for non-join paths", () => {
    expect(extractInviteCodeFromPath("/tournaments")).toBeNull();
    expect(extractInviteCodeFromPath("/join")).toBeNull();
    expect(extractInviteCodeFromPath("/join/")).toBeNull();
    expect(extractInviteCodeFromPath("/joinx/abc")).toBeNull();
    expect(extractInviteCodeFromPath("/hu/join/abc/extra")).toBeNull();
  });
});

describe("decideInviteAction", () => {
  it("captures on a /join path regardless of session", () => {
    expect(
      decideInviteAction({ pathname: "/join/X1", hasSession: false, hasPending: false }),
    ).toEqual({
      type: "capture",
      code: "X1",
    });
    expect(
      decideInviteAction({ pathname: "/hu/join/X1", hasSession: true, hasPending: true }),
    ).toEqual({
      type: "capture",
      code: "X1",
    });
  });

  it("claims when authenticated with a pending invite, off the join page", () => {
    expect(
      decideInviteAction({ pathname: "/tournaments", hasSession: true, hasPending: true }),
    ).toEqual({
      type: "claim",
    });
  });

  it("does nothing without both a session and a pending invite", () => {
    expect(
      decideInviteAction({ pathname: "/tournaments", hasSession: true, hasPending: false }),
    ).toEqual({
      type: "none",
    });
    expect(
      decideInviteAction({ pathname: "/tournaments", hasSession: false, hasPending: true }),
    ).toEqual({
      type: "none",
    });
  });

  it("exposes stable cookie constants", () => {
    expect(PENDING_INVITE_COOKIE).toBe("tc_pending_invite");
    expect(PENDING_INVITE_MAX_AGE_SECONDS).toBe(2_592_000);
  });
});
