"use client";

import { useTranslations } from "next-intl";
import useSWR from "swr";
import { getMatchGroupBets } from "@/actions/live";
import { MatchTipsTab } from "@/components/match-tips-tab";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface TipMatrixStatsDialogProps {
  groupId: string;
  matchId: string;
  title: string;
  isFinished: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TipMatrixStatsDialog({
  groupId,
  matchId,
  title,
  isFinished,
  open,
  onOpenChange,
}: TipMatrixStatsDialogProps) {
  const t = useTranslations("tipMatrix");
  const tm = useTranslations("matches");

  const { data, isLoading } = useSWR(
    open ? ["tip-matrix-stats", groupId, matchId] : null,
    () => getMatchGroupBets(matchId),
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );

  const group = data?.find((g) => g.groupId === groupId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-[14px]">{title}</DialogTitle>
        </DialogHeader>
        {isLoading && <p className="text-muted-foreground text-sm">{t("loading")}</p>}
        {!isLoading && !group && <p className="text-muted-foreground text-sm">{t("noTips")}</p>}
        {group && (
          <MatchTipsTab
            bets={group.bets}
            currentUserId=""
            isFinished={isFinished}
            youLabel={tm("youLabel")}
            oddsBoost={group.oddsBoost}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
