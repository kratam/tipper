import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { getLiveMatchData, type LiveMatchData } from "@/actions/live";
import type { MatchCardData } from "@/components/match-card";
import { mergeMatchData } from "@/lib/live/merge-match-data";
import { liveKeys } from "@/lib/live/query-keys";
import { inMatchWindow } from "@/lib/match-poll-window";

const ONE_MINUTE = 60 * 1000;
const TICK_MS = 60 * 1000;

// A torna meccseinek élő rétege (score/status/tipp-payout). A statikus
// `matches` propot (SSR) beolvasztja a TanStack cache friss snapshotjával.
// Nincs élő score (odds-api nem adja), ezért a polling csak a meccs-ablakban
// fut (~1 perc), egyébként ki van kapcsolva.
export function useMatches(
  tournamentId: string,
  matches: readonly MatchCardData[],
): MatchCardData[] {
  // A meccs-ablakot percenként újraértékeljük, hogy egy nyitva felejtett tab
  // DB-hívás nélkül le-/felpörögjön, amikor az ablak be-/kinyílik.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const matchTimes = useMemo(() => matches.map((m) => Date.parse(m.scheduledAt)), [matches]);
  const active = useMemo(() => inMatchWindow(matchTimes, now), [matchTimes, now]);

  const { data } = useQuery({
    queryKey: liveKeys.matches(tournamentId),
    queryFn: () => getLiveMatchData(tournamentId),
    refetchInterval: active ? ONE_MINUTE : false,
  });

  return useMemo(() => mergeMatchData(matches, data), [matches, data]);
}

// A matches query NYERS olvasása (merge nélkül) — a TipMatrix score/payout
// beolvasztásához. Ugyanaz a queryKey, mint a useMatches → közös cache.
export function useMatchesRaw(tournamentId: string): LiveMatchData[] | undefined {
  const { data } = useQuery({
    queryKey: liveKeys.matches(tournamentId),
    queryFn: () => getLiveMatchData(tournamentId),
    enabled: !!tournamentId,
  });
  return data;
}
