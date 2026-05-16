"use client";

import { Info, Loader2, Minus, Plus } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { type ReactNode, useState, useTransition } from "react";
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
  oddsBoost: number;
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
  onSuccess?: () => void;
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
      <span className="w-7 text-center font-bold font-mono text-2xl tabular-nums">{value}</span>
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

function BalanceInfoTooltip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setOpen((v) => !v);
            }}
            className="inline-flex cursor-pointer"
            aria-label={label}
          >
            <Info className="size-3.5 text-muted-foreground/50" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="font-mono text-xs">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function TeamLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  if (logoUrl) {
    return (
      <Image src={logoUrl} alt={name} width={40} height={40} className="size-10 object-contain" />
    );
  }
  return (
    <span className="flex size-10 items-center justify-center rounded bg-muted font-bold font-mono text-xs">
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
  const seenValues = new Set<number>();
  const seenLabels = new Set<string>();

  for (const { value, label } of [
    { value: evenShare, label: `${evenPct}%` },
    { value: doubleShare, label: `${doublePct}%` },
    { value: balance, label: "MAX" },
  ]) {
    if (value >= 1 && !seenValues.has(value) && !seenLabels.has(label)) {
      seenValues.add(value);
      seenLabels.add(label);
      presets.push({ value, label });
    }
  }
  return presets;
}

function computeDefaultStake(balance: number, matchCount: number): number {
  return Math.max(1, Math.floor(balance / matchCount));
}

export function BetForm({
  matchId,
  groups,
  odds,
  homeTeam,
  awayTeam,
  scheduledAt,
  onSuccess,
}: BetFormProps) {
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
  const [stakeInputs, setStakeInputs] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const g of groups) {
      const value =
        g.existingBet?.stake ?? computeDefaultStake(g.projectedBalance, g.unbettedMatchCountOnDay);
      initial[g.groupId] = String(value);
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
      const group = groups.find((g) => g.groupId === groupId);
      const isUpdate = !!group?.existingBet;
      const params = {
        home: homeTeam.name,
        away: awayTeam.name,
        homeScore: String(homeScore),
        awayScore: String(awayScore),
        stake: String(stakes[groupId] ?? 0),
        group: group?.groupName ?? "",
      };
      toast(isUpdate ? t("updateSuccess", params) : t("success", params), {
        description: isUpdate ? t("updateSuccessDesc", params) : t("successDesc", params),
        icon: isUpdate ? "✏️" : "✅",
      });
      router.refresh();
      onSuccess?.();
    });
  }

  function handleCancel(betId: string) {
    startTransition(async () => {
      const result = await cancelBet(betId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const group = groups.find((g) => g.existingBet?.id === betId);
      toast(t("cancelSuccess", { home: homeTeam.name, away: awayTeam.name }), {
        description: t("cancelSuccessDesc", { group: group?.groupName ?? "" }),
        icon: "🗑️",
      });
      router.refresh();
      onSuccess?.();
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
            <span className="text-center font-medium text-xs leading-tight">{homeTeam.name}</span>
            <div />
            <span className="text-center font-medium text-xs leading-tight">{awayTeam.name}</span>

            {/* Score steppers with colon */}
            <div className="flex justify-center pt-1">
              <ScoreStepper value={homeScore} onChange={setHomeScore} />
            </div>
            <span className="pt-1 text-center font-mono text-lg text-muted-foreground">:</span>
            <div className="flex justify-center pt-1">
              <ScoreStepper value={awayScore} onChange={setAwayScore} />
            </div>
            {/* Odds row */}
            {odds
              ? [
                  { label: "1", value: odds.homeOdds, outcome: "1" },
                  { label: "X", value: odds.drawOdds, outcome: "X" },
                  { label: "2", value: odds.awayOdds, outcome: "2" },
                ].map((o) => (
                  <div key={o.label} className="flex justify-center pt-1">
                    <div
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-mono text-sm transition-colors ${
                        predictedOutcome === o.outcome
                          ? "bg-amber-500/20 text-amber-700 ring-1 ring-amber-500/40"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <span className="text-[10px] opacity-50">{o.label}</span>
                      <span className="font-semibold">{o.value}</span>
                    </div>
                  </div>
                ))
              : null}
          </div>
          {!odds && (
            <p className="text-center text-amber-500 text-xs">{tMatches("oddsNotAvailable")}</p>
          )}
        </div>

        {/* Per-group stake + submit */}
        {groups.map((group) => {
          const effectiveBalance = group.projectedBalance + (group.existingBet?.stake ?? 0);
          return (
            <div key={group.groupId} className="border-border border-t px-5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-medium text-sm">
                  {group.groupName}
                  {odds && (
                    <span className="ml-1 font-mono text-amber-500 text-xs">
                      (
                      {(
                        Number(
                          predictedOutcome === "1"
                            ? odds.homeOdds
                            : predictedOutcome === "X"
                              ? odds.drawOdds
                              : odds.awayOdds,
                        ) * group.oddsBoost
                      ).toFixed(2)}
                      )
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-muted-foreground text-xs">
                    {t("projectedBalance")}: {effectiveBalance}
                  </span>
                  {(group.pendingDistributions > 0 || group.existingBet) && (
                    <BalanceInfoTooltip label={t("balanceDetails")}>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex justify-between gap-4">
                          <span>{t("actualBalance")}:</span>
                          <span>{group.balance}</span>
                        </div>
                        {group.pendingDistributions > 0 && (
                          <div className="flex justify-between gap-4">
                            <span>{t("pendingTokens")}:</span>
                            <span>
                              +{group.pendingDistributions * group.tokenPerMatch} (
                              {group.pendingDistributions} × {group.tokenPerMatch})
                            </span>
                          </div>
                        )}
                        {group.existingBet && (
                          <div className="flex justify-between gap-4">
                            <span>{t("currentStake")}:</span>
                            <span>+{group.existingBet.stake}</span>
                          </div>
                        )}
                        <div className="my-0.5 border-primary-foreground/20 border-t" />
                        <div className="flex justify-between gap-4 font-bold">
                          <span>{t("projectedBalance")}:</span>
                          <span>{effectiveBalance}</span>
                        </div>
                      </div>
                    </BalanceInfoTooltip>
                  )}
                </div>
              </div>

              {/* Stake chips + custom input */}
              <div className="mb-3 flex items-center gap-1.5">
                <span className="mr-1 shrink-0 text-muted-foreground text-xs">{t("stake")}</span>
                {computeStakePresets(effectiveBalance, group.unbettedMatchCountOnDay).map(
                  (preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setStakes({ ...stakes, [group.groupId]: preset.value });
                        setStakeInputs({ ...stakeInputs, [group.groupId]: String(preset.value) });
                      }}
                      className={`flex flex-col items-center rounded-md px-2.5 py-1 font-medium font-mono text-xs transition-colors ${
                        stakes[group.groupId] === preset.value
                          ? "bg-foreground text-card"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="text-[10px] leading-none opacity-60">{preset.label}</span>
                      <span>{preset.value}</span>
                    </button>
                  ),
                )}
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={stakeInputs[group.groupId] ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    setStakeInputs({ ...stakeInputs, [group.groupId]: raw });
                    const num = Number(raw);
                    if (raw !== "" && num >= 0) {
                      setStakes({ ...stakes, [group.groupId]: num });
                    }
                  }}
                  onBlur={() => {
                    const num = Number(stakeInputs[group.groupId]);
                    if (!stakeInputs[group.groupId] || num < 1) {
                      setStakes({ ...stakes, [group.groupId]: 1 });
                      setStakeInputs({ ...stakeInputs, [group.groupId]: "1" });
                    } else if (num > effectiveBalance) {
                      setStakes({ ...stakes, [group.groupId]: effectiveBalance });
                      setStakeInputs({
                        ...stakeInputs,
                        [group.groupId]: String(effectiveBalance),
                      });
                    }
                  }}
                  className="ml-auto w-14 rounded-md border border-input bg-transparent px-2 py-1 text-center font-mono text-xs"
                />
              </div>

              {/* Submit + cancel */}
              <div className="flex gap-2">
                <Button
                  onClick={() => handleSubmit(group.groupId)}
                  disabled={
                    isPending ||
                    (stakes[group.groupId] ?? 0) > effectiveBalance ||
                    (stakes[group.groupId] ?? 0) < 1
                  }
                  size="sm"
                  className="flex-1"
                >
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : group.existingBet ? (
                    t("update")
                  ) : (
                    t("submit")
                  )}
                </Button>
                {group.existingBet && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleCancel(group.existingBet?.id ?? "")}
                    disabled={isPending}
                  >
                    {isPending ? <Loader2 className="size-4 animate-spin" /> : t("cancel")}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
