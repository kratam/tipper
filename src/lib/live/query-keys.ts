// Központi query-kulcs registry. Minden élő-adat kulcs innen jön — nincs
// szétszórt ad-hoc kulcs a komponensekben. A hierarchia (torna → group →
// domain) prefix-alapú invalidációt tesz lehetővé: pl. invalidateQueries a
// group(gid) prefixre egyszerre frissíti a leaderboard/balance/tipMatrix-ot.
export const liveKeys = {
  tournament: (tid: string) => ["tournament", tid] as const,
  matches: (tid: string) => ["tournament", tid, "matches"] as const,

  group: (gid: string) => ["group", gid] as const,
  leaderboard: (gid: string) => ["group", gid, "leaderboard"] as const,
  balance: (gid: string) => ["group", gid, "balance"] as const,
  tipMatrix: (gid: string, roundKey: string) => ["group", gid, "tipMatrix", roundKey] as const,

  notifications: {
    unread: () => ["notifications", "unread"] as const,
    list: () => ["notifications", "list"] as const,
  },
} as const;
