"use client";

import { Info, Minus, Plus } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelBet, placeBet } from "@/actions/bets";
import { FormattedDate } from "@/components/formatted-date";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useRouter } from "@/i18n/navigation";

interface GroupBetInfo {
  groupId: string;
  groupName: string;
  balance: number;
  projectedBalance: number;
  pendingDistributions: number;
  tokenPerMatch: number;
  existingBet: {
    id: string;
    predictedHome: number;
    predictedAway: number;
    stake: number;
  } | null;
  unbettedMatchCountOnDay: number;
}

interface BetFormProps {
  matchId: string;
  groups: GroupBetInfo[];
  odds: { homeOdds: string; drawOdds: string; awayOdds: string } | null;
  homeTeam: { name: string; logoUrl: string | null };
  awayTeam: { name: string; logoUrl: string | null };
  scheduledAt: string;
}

function ScoreStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="flex size-7 items-center justify-center rounded-full bg-muted/80 text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-90"
      >
        <Minus className="size-3" />
      </button>
      <span className="w-7 text-center font-mono text-2xl font-bold tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(99, value + 1))}
        className="flex size-7 items-center justify-center rounded-full bg-muted/80 text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-90"
      >
        <Plus className="size-3" />
      </button>
    </div>
  );
}

function TeamLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  if (logoUrl) {
    return (
      <Image src={logoUrl} alt={name} width={40} height={40} className="size-10 object-contain" />
    );
  }
  return (
    <span className="flex size-10 items-center justify-center rounded bg-muted font-mono text-xs font-bold">
      {name.slice(0, 3).toUpperCase()}
    </span>
  );
}

function computeStakePresets(
  balance: number,
  matchCount: number,
): { value: number; label: string }[] {
  const evenShare = Math.floor(balance / matchCount);
  const doubleShare = Math.floor((balance * 2) / matchCount);
  const evenPct = Math.round(100 / matchCount);
  const doublePct = Math.min(100, evenPct * 2);
  const presets: { value: number; label: string }[] = [];
  const seen = new Set<number>();

  for (const { value, label } of [
    { value: evenShare, label: `${evenPct}%` },
    { value: doubleShare, label: `${doublePct}%` },
    { value: balance, label: "MAX" },
  ]) {
    if (value >= 1 && !seen.has(value)) {
      seen.add(value);
      presets.push({ value, label });
    }
  }
  return presets;
}

function computeDefaultStake(balance: number, matchCount: number): number {
  return Math.max(1, Math.floor(balance / matchCount));
}

export function BetForm({ matchId, groups, odds, homeTeam, awayTeam, scheduledAt }: BetFormProps) {
  const t = useTranslations("betting");
  const tMatches = useTranslations("matches");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [homeScore, setHomeScore] = useState<number>(groups[0]?.existingBet?.predictedHome ?? 0);
  const [awayScore, setAwayScore] = useState<number>(groups[0]?.existingBet?.predictedAway ?? 0);
  const [stakes, setStakes] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const g of groups) {
      initial[g.groupId] =
        g.existingBet?.stake ?? computeDefaultStake(g.projectedBalance, g.unbettedMatchCountOnDay);
    }
    return initial;
  });

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
        groups.find((g) => g.groupId === groupId)?.existingBet ? t("updateSuccess") : t("success"),
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

  if (groups.length === 0) {
    return null;
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Match header + score prediction */}
        <div className="flex flex-col items-center gap-4 px-5 pt-5 pb-4">
          <span className="font-mono text-[11px] text-muted-foreground">
            <FormattedDate date={scheduledAt} />
          </span>

          {/* Teams + inline score steppers */}
          <div className="grid w-full max-w-xs grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-1.5">
            {/* Logos */}
            <div className="flex justify-center">
              <TeamLogo name={homeTeam.name} logoUrl={homeTeam.logoUrl} />
            </div>
            <div />
            <div className="flex justify-center">
              <TeamLogo name={awayTeam.name} logoUrl={awayTeam.logoUrl} />
            </div>

            {/* Names */}
            <span className="text-center text-xs font-medium leading-tight">{homeTeam.name}</span>
            <div />
            <span className="text-center text-xs font-medium leading-tight">{awayTeam.name}</span>

            {/* Score steppers with colon */}
            <div className="flex justify-center pt-1">
              <ScoreStepper value={homeScore} onChange={setHomeScore} />
            </div>
            <span className="pt-1 text-center font-mono text-lg text-muted-foreground">:</span>
            <div className="flex justify-center pt-1">
              <ScoreStepper value={awayScore} onChange={setAwayScore} />
            </div>
          </div>

          {/* Odds */}
          {odds ? (
            <div className="flex gap-2">
              {[
                { label: "1", value: odds.homeOdds, outcome: "1" },
                { label: "X", value: odds.drawOdds, outcome: "X" },
                { label: "2", value: odds.awayOdds, outcome: "2" },
              ].map((o) => (
                <div
                  key={o.label}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-mono text-sm transition-colors ${
                    predictedOutcome === o.outcome
                      ? "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <span className="text-[10px] opacity-50">{o.label}</span>
                  <span className="font-semibold">{o.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-xs text-amber-500">{tMatches("oddsNotAvailable")}</p>
          )}
        </div>

        {/* Per-group stake + submit */}
        {groups.map((group) => (
          <div key={group.groupId} className="border-t border-border px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium">{group.groupName}</span>
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs text-muted-foreground">
                  {t("projectedBalance")}: {group.projectedBalance}
                </span>
                {group.pendingDistributions > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="size-3.5 text-muted-foreground/50" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="font-mono text-xs">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex justify-between gap-4">
                            <span>{t("actualBalance")}:</span>
                            <span>{group.balance}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span>{t("pendingTokens")}:</span>
                            <span>
                              +{group.pendingDistributions * group.tokenPerMatch} (
                              {group.pendingDistributions} × {group.tokenPerMatch})
                            </span>
                          </div>
                          <div className="my-0.5 border-t border-primary-foreground/20" />
                          <div className="flex justify-between gap-4 font-bold">
                            <span>{t("projectedBalance")}:</span>
                            <span>{group.projectedBalance}</span>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>

            {/* Stake chips + custom input */}
            <div className="mb-3 flex items-center gap-1.5">
              <span className="mr-1 shrink-0 text-xs text-muted-foreground">{t("stake")}</span>
              {computeStakePresets(group.projectedBalance, group.unbettedMatchCountOnDay).map(
                (preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setStakes({ ...stakes, [group.groupId]: preset.value })}
                    className={`flex flex-col items-center rounded-md px-2.5 py-1 font-mono text-xs font-medium transition-colors ${
                      stakes[group.groupId] === preset.value
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="text-[10px] leading-none opacity-60">{preset.label}</span>
                    <span>{preset.value}</span>
                  </button>
                ),
              )}
              <input
                type="number"
                min={1}
                max={group.projectedBalance}
                value={stakes[group.groupId] ?? 1}
                onChange={(e) => setStakes({ ...stakes, [group.groupId]: Number(e.target.value) })}
                className="ml-auto w-14 rounded-md border border-input bg-transparent px-2 py-1 text-center font-mono text-xs"
              />
            </div>

            {/* Submit + cancel */}
            <div className="flex gap-2">
              <Button
                onClick={() => handleSubmit(group.groupId)}
                disabled={
                  isPending ||
                  (stakes[group.groupId] ?? 0) > group.projectedBalance ||
                  (stakes[group.groupId] ?? 0) < 1
                }
                size="sm"
                className="flex-1"
              >
                {group.existingBet ? t("update") : t("submit")}
              </Button>
              {group.existingBet && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleCancel(group.existingBet?.id ?? "")}
                  disabled={isPending}
                >
                  {t("cancel")}
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
