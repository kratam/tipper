import type { QueryClient } from "@tanstack/react-query";
import { liveKeys } from "./query-keys";

// Tippadás/visszavonás utáni egységes invalidáció. Egyetlen hívás frissít
// minden felületet, ahol a tipp/egyenleg/leaderboard megjelenik:
// - matches(tid): a néző tippjei+payout minden meccs-nézeten (MatchCard, TipMatrix)
// - group(gid) prefix: tipMatrix + leaderboard + balance (Fázis 2/4-ben élesedik)
export async function invalidateAfterBet(
  qc: QueryClient,
  ctx: { tournamentId: string; groupId: string },
): Promise<void> {
  await Promise.all([
    qc.invalidateQueries({ queryKey: liveKeys.matches(ctx.tournamentId) }),
    qc.invalidateQueries({ queryKey: liveKeys.group(ctx.groupId) }),
  ]);
}
