import { describe, expect, it } from "vitest";
import { liveKeys } from "./query-keys";

describe("liveKeys", () => {
  it("a matches kulcs a torna-id alá hierarchizál", () => {
    expect(liveKeys.matches("t1")).toEqual(["tournament", "t1", "matches"]);
  });

  it("a tournament prefix része a matches kulcsnak (prefix-invalidációhoz)", () => {
    const prefix = liveKeys.tournament("t1");
    const matches = liveKeys.matches("t1");
    expect(matches.slice(0, prefix.length)).toEqual(prefix);
  });

  it("a group prefix része a leaderboard/balance/tipMatrix kulcsoknak", () => {
    const prefix = liveKeys.group("g1");
    expect(liveKeys.leaderboard("g1").slice(0, prefix.length)).toEqual(prefix);
    expect(liveKeys.balance("g1").slice(0, prefix.length)).toEqual(prefix);
    expect(liveKeys.tipMatrix("g1", "r1").slice(0, prefix.length)).toEqual(prefix);
  });

  it("a tipMatrix kulcs a roundKey-t is tartalmazza", () => {
    expect(liveKeys.tipMatrix("g1", "r1")).toEqual(["group", "g1", "tipMatrix", "r1"]);
  });

  it("a notifications kulcsok stabilak", () => {
    expect(liveKeys.notifications.unread()).toEqual(["notifications", "unread"]);
    expect(liveKeys.notifications.list()).toEqual(["notifications", "list"]);
  });
});
