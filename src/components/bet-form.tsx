"use client";

import { Info, Loader2, Lock, Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelBet, placeBet } from "@/actions/bets";
import { GroupRulesDialog } from "@/components/group-rules-dialog";
import { TeamLogo } from "@/components/team-logo";
import { TokenIcon } from "@/components/token-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useRouter } from "@/i18n/navigation";
import { formatEffectiveOdds } from "@/lib/odds-display";
import { clampPerMatch, computeStakePresets } from "@/lib/stake-presets";

interface GroupBetInfo {
  groupId: string;
  groupName: string;
  balance: number;
  projectedBalance: number;
  pendingDistributions: number;
  tokenPerMatch: number;
  initialTokens: number;
  eligibleMatchCount: number;
  winnings: number;
  losses: number;
  otherActiveStakes: number;
  oddsBoost: number;
  lossPercentage: number;
  bonusGoalDiff: number;
  bonusExactScore: number;
  bonusPodiumMention: number;
  bonusPodiumExact: number;
  existingBet: {
    id: string;
    predictedHome: number;
    predictedAway: number;
    stake: number;
    oddsAtBet: string | null;
  } | null;
  unbettedMatchCountOnDay: number;
}

interface BetFormProps {
  matchId: string;
  groups: GroupBetInfo[];
  odds: { homeOdds: string; drawOdds: string; awayOdds: string } | null;
  homeTeam: { name: string; logoUrl: string | null };
  awayTeam: { name: string; logoUrl: string | null };
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

function BalanceInfoTooltip({
  label,
  children,
  contentClassName = "font-mono text-xs",
}: {
  label: string;
  children: ReactNode;
  contentClassName?: string;
}) {
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
        <TooltipContent side="top" className={contentClassName}>
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function BetForm({ matchId, groups, odds, homeTeam, awayTeam, onSuccess }: BetFormProps) {
  const t = useTranslations("betting");
  const tMatches = useTranslations("matches");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [homeScore, setHomeScore] = useState<number>(groups[0]?.existingBet?.predictedHome ?? 0);
  const [awayScore, setAwayScore] = useState<number>(groups[0]?.existingBet?.predictedAway ?? 0);
  const [stakes, setStakes] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const g of groups) {
      const effective = g.projectedBalance + (g.existingBet?.stake ?? 0);
      initial[g.groupId] = g.existingBet?.stake ?? clampPerMatch(g.tokenPerMatch, effective);
    }
    return initial;
  });
  const [stakeInputs, setStakeInputs] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const g of groups) {
      const effective = g.projectedBalance + (g.existingBet?.stake ?? 0);
      const value = g.existingBet?.stake ?? clampPerMatch(g.tokenPerMatch, effective);
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
    <Card className="overflow-hidden border-0 bg-transparent shadow-none">
      <CardContent className="p-0">
        {/* Match header + score prediction (date lives in the dialog header) */}
        <div className="flex flex-col items-center gap-2 px-5 pt-1 pb-4">
          {/* Teams + inline score steppers */}
          <div className="grid w-full max-w-xs grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-1.5">
            {/* Logos */}
            <div className="flex justify-center">
              <TeamLogo name={homeTeam.name} logoUrl={homeTeam.logoUrl} size={40} />
            </div>
            <div />
            <div className="flex justify-center">
              <TeamLogo name={awayTeam.name} logoUrl={awayTeam.logoUrl} size={40} />
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
          const selectedRawOdds = odds
            ? predictedOutcome === "1"
              ? odds.homeOdds
              : predictedOutcome === "X"
                ? odds.drawOdds
                : odds.awayOdds
            : null;
          const currentOdds = formatEffectiveOdds(selectedRawOdds, group.oddsBoost);
          const lockedOdds = formatEffectiveOdds(
            group.existingBet?.oddsAtBet ?? null,
            group.oddsBoost,
          );
          return (
            <div key={group.groupId} className="border-border border-t px-5 py-4">
              <div className="mb-3 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1">
                    <span className="truncate font-medium text-sm">{group.groupName}</span>
                    <GroupRulesDialog
                      groupName={group.groupName}
                      rules={{
                        tokenPerMatch: group.tokenPerMatch,
                        initialTokens: group.initialTokens,
                        bonusGoalDiff: group.bonusGoalDiff,
                        bonusExactScore: group.bonusExactScore,
                        bonusPodiumMention: group.bonusPodiumMention,
                        bonusPodiumExact: group.bonusPodiumExact,
                        oddsBoost: group.oddsBoost,
                        lossPercentage: group.lossPercentage,
                      }}
                      iconOnly
                    />
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="font-mono text-muted-foreground text-xs">
                      {t("projectedBalance")}: {effectiveBalance}
                    </span>
                    <BalanceInfoTooltip label={t("balanceDetails")}>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex justify-between gap-4">
                          <span>{t("initialTokens")}:</span>
                          <span>+{group.initialTokens}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span>
                            {t("matchTokens")} ({group.eligibleMatchCount} × {group.tokenPerMatch}):
                          </span>
                          <span>+{group.eligibleMatchCount * group.tokenPerMatch}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span>{t("winnings")}:</span>
                          <span>+{group.winnings}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span>{t("losses")}:</span>
                          <span>{group.losses}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span>{t("lockedStakes")}:</span>
                          <span>
                            {group.otherActiveStakes === 0 ? 0 : -group.otherActiveStakes}
                          </span>
                        </div>
                        <div className="my-0.5 border-primary-foreground/20 border-t" />
                        <div className="flex justify-between gap-4 font-bold">
                          <span>{t("projectedBalance")}:</span>
                          <span>{effectiveBalance}</span>
                        </div>
                      </div>
                    </BalanceInfoTooltip>
                  </div>
                </div>
                {lockedOdds ? (
                  <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-xs">
                    <span className="flex items-center gap-1">
                      <Lock className="size-3 text-amber-500" />
                      <span className="text-amber-500">{lockedOdds}</span>
                    </span>
                    {currentOdds && (
                      <span className="text-muted-foreground">
                        · {t("currentOddsShort")} {currentOdds}
                      </span>
                    )}
                    <BalanceInfoTooltip
                      label={t("oddsInfoLabel")}
                      contentClassName="max-w-56 text-xs"
                    >
                      {t("oddsInfo")}
                    </BalanceInfoTooltip>
                  </span>
                ) : currentOdds ? (
                  <span className="font-mono text-amber-500 text-xs">({currentOdds})</span>
                ) : null}
              </div>

              {/* Stake chips + custom input */}
              <div className="mb-3">
                <span className="mb-1 block text-muted-foreground text-xs">{t("stake")}</span>
                <div className="flex items-center gap-1.5">
                  {computeStakePresets(
                    effectiveBalance,
                    group.unbettedMatchCountOnDay,
                    clampPerMatch(group.tokenPerMatch, effectiveBalance),
                    t("perMatch"),
                  ).map((preset) => (
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
                      {preset.isPerMatch ? (
                        <span role="img" aria-label={preset.label} className="opacity-60">
                          <TokenIcon size={12} />
                        </span>
                      ) : (
                        <span className="text-[10px] leading-none opacity-60">{preset.label}</span>
                      )}
                      <span>{preset.value}</span>
                    </button>
                  ))}
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
