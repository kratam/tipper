import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getTipMatrixRoundAction } from "@/actions/tip-matrix";
import { liveKeys } from "@/lib/live/query-keys";
import type { TipMatrixRound } from "@/queries/tip-matrix";

// A megjelenített forduló SZERKEZETE (ki mit tippelt). A változó score/payout
// nem itt, hanem a közös `matches` query-ben él (applyLiveScores olvasztja be).
// A nem-aktuális (befejezett) fordulók statikusak: staleTime Infinity, nincs
// felesleges refetch — csak invalidációra/forduló-váltásra fetch-el.
export function useTipMatrixRound(
  groupId: string,
  initialRound: TipMatrixRound,
  roundKey: string,
): TipMatrixRound {
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
    staleTime: Number.POSITIVE_INFINITY,
  });
  return data ?? initialRound;
}
