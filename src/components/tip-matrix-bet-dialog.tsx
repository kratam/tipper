"use client";

import useSWR from "swr";
import { getTipMatrixBetInfoAction } from "@/actions/tip-matrix";
import { BetDialog } from "@/components/bet-dialog";

interface TipMatrixBetDialogProps {
  groupId: string;
  matchId: string;
  currentUserId: string;
  timeZone: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TipMatrixBetDialog({
  groupId,
  matchId,
  currentUserId,
  timeZone,
  open,
  onOpenChange,
}: TipMatrixBetDialogProps) {
  const { data } = useSWR(
    open ? ["tip-matrix-bet", groupId, matchId] : null,
    () => getTipMatrixBetInfoAction(groupId, matchId),
    { revalidateOnFocus: false },
  );

  return (
    <BetDialog
      match={data?.match ?? null}
      groups={data ? [data.group] : []}
      open={open}
      onOpenChange={onOpenChange}
      currentUserId={currentUserId}
      timeZone={timeZone}
    />
  );
}
