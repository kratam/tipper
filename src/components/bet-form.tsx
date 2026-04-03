"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelBet, placeBet } from "@/actions/bets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";

interface GroupBetInfo {
  groupId: string;
  groupName: string;
  balance: number;
  existingBet: {
    id: string;
    predictedHome: number;
    predictedAway: number;
    stake: number;
  } | null;
}

interface BetFormProps {
  matchId: string;
  groups: GroupBetInfo[];
  odds: { homeOdds: string; drawOdds: string; awayOdds: string } | null;
  matchStarted: boolean;
}

export function BetForm({ matchId, groups, odds, matchStarted }: BetFormProps) {
  const t = useTranslations("betting");
  const tMatches = useTranslations("matches");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Initialize state from existing bets or defaults
  const [homeScore, setHomeScore] = useState<number>(groups[0]?.existingBet?.predictedHome ?? 0);
  const [awayScore, setAwayScore] = useState<number>(groups[0]?.existingBet?.predictedAway ?? 0);
  const [stakes, setStakes] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const g of groups) {
      initial[g.groupId] = g.existingBet?.stake ?? 10;
    }
    return initial;
  });

  // Determine which outcome the prediction maps to
  const predictedOutcome = homeScore > awayScore ? "1" : homeScore === awayScore ? "X" : "2";

  function handleSubmit(groupId: string) {
    startTransition(async () => {
      const result = await placeBet({
        matchId,
        groupId,
        predictedHome: homeScore,
        predictedAway: awayScore,
        stake: stakes[groupId] ?? 10,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        groups.find((g) => g.groupId === groupId)?.existingBet
          ? t("updateSuccess")
          : t("success"),
      );
      router.refresh();
    });
  }

  function handleCancel(betId: string) {
    startTransition(async () => {
      const result = await cancelBet(betId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(t("cancelSuccess"));
      router.refresh();
    });
  }

  if (matchStarted) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          {tMatches("betLocked")}
        </CardContent>
      </Card>
    );
  }

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Score prediction */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("prediction")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-center gap-4">
            <div className="flex flex-col items-center gap-1">
              <Label className="text-xs text-muted-foreground">{t("homeScore")}</Label>
              <Input
                type="number"
                min={0}
                max={99}
                value={homeScore}
                onChange={(e) => setHomeScore(Number(e.target.value))}
                className="h-14 w-20 text-center font-mono text-3xl font-bold"
              />
            </div>
            <span className="pt-5 font-mono text-2xl text-muted-foreground">:</span>
            <div className="flex flex-col items-center gap-1">
              <Label className="text-xs text-muted-foreground">{t("awayScore")}</Label>
              <Input
                type="number"
                min={0}
                max={99}
                value={awayScore}
                onChange={(e) => setAwayScore(Number(e.target.value))}
                className="h-14 w-20 text-center font-mono text-3xl font-bold"
              />
            </div>
          </div>

          {/* Odds display */}
          {odds ? (
            <div className="flex justify-center gap-3">
              {[
                { label: "1", value: odds.homeOdds, outcome: "1" },
                { label: "X", value: odds.drawOdds, outcome: "X" },
                { label: "2", value: odds.awayOdds, outcome: "2" },
              ].map((o) => (
                <div
                  key={o.label}
                  className={`flex flex-col items-center rounded-lg px-4 py-2 font-mono ${
                    predictedOutcome === o.outcome
                      ? "bg-amber-500/20 text-amber-500 ring-1 ring-amber-500/50"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <span className="text-xs">{o.label}</span>
                  <span className="text-lg font-bold">{o.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-xs text-amber-500">{tMatches("oddsNotAvailable")}</p>
          )}
        </CardContent>
      </Card>

      {/* Per-group stake + submit */}
      {groups.map((group) => (
        <Card key={group.groupId}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{group.groupName}</CardTitle>
            <Badge variant="outline" className="font-mono">
              {t("availableTokens")}: {group.balance}
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">{t("stake")}</Label>
                <Input
                  type="number"
                  min={1}
                  max={group.balance}
                  value={stakes[group.groupId] ?? 10}
                  onChange={(e) =>
                    setStakes({
                      ...stakes,
                      [group.groupId]: Number(e.target.value),
                    })
                  }
                  className="w-24 font-mono"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => handleSubmit(group.groupId)}
                disabled={isPending}
                className="flex-1"
              >
                {group.existingBet ? t("update") : t("submit")}
              </Button>
              {group.existingBet && (
                <Button
                  variant="destructive"
                  onClick={() => handleCancel(group.existingBet?.id ?? "")}
                  disabled={isPending}
                >
                  {t("cancel")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
