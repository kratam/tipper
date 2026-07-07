import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getTipMatrixRoundAction } from "@/actions/tip-matrix";
import { liveKeys } from "@/lib/live/query-keys";
import { inMatchWindow } from "@/lib/match-poll-window";
import type { TipMatrixRound } from "@/queries/tip-matrix";

const ONE_MINUTE = 60 * 1000;
const TICK_MS = 60 * 1000;

const roundMatchTimes = (r: TipMatrixRound) => r.matches.map((m) => Date.parse(m.scheduledAt));

// A megjelenített forduló SZERKEZETE (ki mit tippelt) + a meccsenkénti
// `locked` reveal-kapu. A változó score/payout nem itt, hanem a közös
// `matches` query-ben él (applyLiveScores olvasztja be).
//
// FONTOS: a szerver a tippeket lock ELŐTT szűri (mások tippjeit nem küldi le),
// a `locked` flaget pedig a fetch pillanatában számolja. Ezért egy lock ELŐTT
// betöltött snapshot elavul, amint a meccs lockol/befejeződik — a reveal-kapu
// zárva marad, amíg a query újra nem fut. Régen ez `staleTime: Infinity` volt,
// ami a `refetchOnWindowFocus`-t is kikapcsolta → egy éjjel nyitva hagyott,
// reggel visszahozott tab a stale (rejtett tippes) snapshotot mutatta, miközben
// a score-réteg már frissült. Ezért:
//   - staleTime: a globális default (30s) → fókuszra refetchel, így a szerver
//     újra kinyitja a reveal-kaput és leküldi mindenki tippjét + friss locked-ot;
//   - refetchInterval: CSAK a meccs-ablakban (kickoff−10p … +3ó) pollol, a
//     score-réteggel párhuzamosan → nyitva hagyott élő tabon is élőben reveal-ol.
//     Ablakon kívül nincs polling → a Neon compute tud aludni (scale-to-zero).
export function useTipMatrixRound(
  groupId: string,
  initialRound: TipMatrixRound,
  roundKey: string,
): TipMatrixRound {
  // Percenkénti tick: a meccs-ablak be-/kinyílását DB-hívás nélkül újraértékeli
  // (mint useMatches), így egy nyitva hagyott tab is el-/leáll pollozni.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const { data } = useQuery({
    queryKey: liveKeys.tipMatrix(groupId, roundKey),
    queryFn: async () => {
      const r = await getTipMatrixRoundAction(groupId, roundKey);
      return r ?? initialRound;
    },
    initialData: initialRound.roundKey === roundKey ? initialRound : undefined,
    // Forduló-váltáskor (még nem cache-elt roundKey) a friss fetch alatt az
    // ELŐZŐ forduló adatát mutatjuk (lapozás-UX), nem az initialRound-ot —
    // így nem villan be tévesen a kezdő forduló tartalma.
    placeholderData: keepPreviousData,
    // A `now` a closure-ból a percenkénti tickkel frissül → az ablak-váltáskor
    // a refetchInterval újraértékelődik; a snapshot a query state-ből jön, így
    // mindig a legfrissebb lekért forduló meccs-időit nézzük.
    refetchInterval: (query) =>
      inMatchWindow(roundMatchTimes(query.state.data ?? initialRound), now) ? ONE_MINUTE : false,
  });
  return data ?? initialRound;
}
