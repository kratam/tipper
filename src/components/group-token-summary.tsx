"use client";

import { CircleAlert, CircleCheck, Coins } from "lucide-react";
import { useTranslations } from "next-intl";

interface GroupTokenSummaryItem {
  groupId: string;
  groupName: string;
  balance: number;
  unbettedCount: number;
}

interface GroupTokenSummaryProps {
  groups: GroupTokenSummaryItem[];
}

export function GroupTokenSummary({ groups }: GroupTokenSummaryProps) {
  const t = useTranslations("tournaments");

  if (groups.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {groups.map((g) => {
        const hasWarning = g.balance > 0 && g.unbettedCount > 0;

        return (
          <div
            key={g.groupId}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
              hasWarning
                ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30"
                : "border-border bg-muted/30"
            }`}
          >
            <span className="font-medium">{g.groupName}</span>

            <span className="flex items-center gap-1 text-muted-foreground">
              <Coins className="size-3.5" />
              {t("tokenBalance", { balance: g.balance })}
            </span>

            {hasWarning ? (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <CircleAlert className="size-3.5" />
                {t("unbettedMatches", { count: g.unbettedCount })}
              </span>
            ) : g.unbettedCount === 0 ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CircleCheck className="size-3.5" />
                {t("allBetsPlaced")}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
