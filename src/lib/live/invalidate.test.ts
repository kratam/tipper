import { describe, expect, it, vi } from "vitest";
import { invalidateAfterBet } from "./invalidate";
import { liveKeys } from "./query-keys";

describe("invalidateAfterBet", () => {
  it("a matches és a group prefix kulcsokat invalidálja", async () => {
    const calls: unknown[] = [];
    const qc = {
      invalidateQueries: vi.fn(async (arg) => {
        calls.push(arg);
      }),
    };
    await invalidateAfterBet(qc as never, { tournamentId: "t1", groupId: "g1" });

    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: liveKeys.matches("t1") });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: liveKeys.group("g1") });
  });
});
