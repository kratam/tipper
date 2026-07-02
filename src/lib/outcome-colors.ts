/**
 * Shared 1/X/2 outcome colours — the single source of truth for both the match
 * statistics bar (`match-stats-tab.tsx`) and the per-bet tip chip (`bet-row.tsx`).
 *
 * "Hűvös trió" palette: cyan (home) / indigo (draw) / fuchsia (away). Deliberately
 * avoids green and red, which are reserved for win/loss (payout) semantics.
 */
import type { Outcome1x2 } from "@/lib/match-stats";

/** Vertical gradient (top → bottom) per outcome, used as an inline `background`. */
export const OUTCOME_GRADIENT: Record<Outcome1x2, string> = {
  "1": "linear-gradient(180deg, #22d3ee, #0891b2)",
  X: "linear-gradient(180deg, #6366f1, #4338ca)",
  "2": "linear-gradient(180deg, #d946ef, #a21caf)",
};
