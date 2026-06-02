"use client";

import { Info, Loader2, Lock, Minus, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelBet, placeBet } from "@/actions/bets";
import { MatchScoreboard } from "@/components/match-scoreboard";
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
  const t = useTranslations("betting");
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(Math.min(99, value + 1))}
        className="grid h-6 w-[38px] place-items-center rounded-lg border border-border bg-surface-2 text-muted-foreground transition-all hover:bg-surface-3 hover:text-foreground active:scale-90"
        aria-label={t("increaseScore")}
      >
        <Plus className="size-3.5" />
      </button>
      <span className="w-11 text-center font-extrabold font-mono text-[34px] tabular-nums leading-none">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="grid h-6 w-[38px] place-items-center rounded-lg border border-border bg-surface-2 text-muted-foreground transition-all hover:bg-surface-3 hover:text-foreground active:scale-90"
        aria-label={t("decreaseScore")}
      >
        <Minus className="size-3.5" />
      </button>
    </div>
  );
}

/** Egy odds-cella a scoreboard alá igazítva (1 = hazai, X = döntetlen, 2 = vendég). */
function OddCell({ label, value, selected }: { label: string; value: string; selected: boolean }) {
  return (
    <div
      className={`flex items-center justify-center gap-1.5 rounded-lg border p-[7px] font-mono text-sm transition-colors ${
        selected
          ? "border-gold-line bg-gold-soft font-bold text-gold"
          : "border-border bg-surface-2 text-muted-foreground"
      }`}
    >
      <span className="text-[10px] opacity-60">{label}</span>
      <span>{value}</span>
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
            <Info className="size-3.5 text-faint" />
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
        <div className="flex flex-col items-center gap-3 px-5 pt-1 pb-4">
          <MatchScoreboard
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            center={
              <div className="flex items-center gap-2">
                <ScoreStepper value={homeScore} onChange={setHomeScore} />
                <span className="font-mono text-[22px] text-faint">:</span>
                <ScoreStepper value={awayScore} onChange={setAwayScore} />
              </div>
            }
            bottomRow={
              odds
                ? {
                    home: (
                      <OddCell
                        label="1"
                        value={odds.homeOdds}
                        selected={predictedOutcome === "1"}
                      />
                    ),
                    center: (
                      <OddCell
                        label="X"
                        value={odds.drawOdds}
                        selected={predictedOutcome === "X"}
                      />
                    ),
                    away: (
                      <OddCell
                        label="2"
                        value={odds.awayOdds}
                        selected={predictedOutcome === "2"}
                      />
                    ),
                  }
                : undefined
            }
          />
          {!odds && <p className="text-center text-gold text-xs">{tMatches("oddsNotAvailable")}</p>}
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
              {/* Csoport meta: név + tippelhető egyenleg */}
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate font-semibold text-sm">{group.groupName}</span>
                <span className="flex shrink-0 items-center gap-1 font-mono text-faint text-xs">
                  {t("projectedBalance")} {effectiveBalance}
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
                        <span>{group.otherActiveStakes === 0 ? 0 : -group.otherActiveStakes}</span>
                      </div>
                      <div className="my-0.5 border-border border-t" />
                      <div className="flex justify-between gap-4 font-bold">
                        <span>{t("projectedBalance")}:</span>
                        <span>{effectiveBalance}</span>
                      </div>
                    </div>
                  </BalanceInfoTooltip>
                </span>
              </div>
              {/* Odds: lock-olt érték, és ha eltér, az újrakötéskori aktuális */}
              {lockedOdds ? (
                <div className="mt-0.5 flex items-center gap-1 font-mono text-muted-foreground text-xs">
                  <Lock className="size-3 text-gold" />
                  <span className="text-gold">{lockedOdds}</span>
                  {currentOdds && currentOdds !== lockedOdds && (
                    <span>
                      · {t("currentOddsShort")} {currentOdds}
                    </span>
                  )}
                </div>
              ) : currentOdds ? (
                <span className="mt-0.5 block font-mono text-gold text-xs">@ {currentOdds}</span>
              ) : null}

              {/* Tét: érték-mező + gyors preset gombok (rácsban, hogy mobilon se fusson ki) */}
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs">{t("stake")}</span>
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
                    className="w-24 rounded-lg border border-border bg-surface-2 px-2 py-1 text-center font-mono text-foreground text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
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
                      className={`flex items-center justify-center gap-1 rounded-lg border px-1 py-2 font-mono font-semibold text-[13px] transition-colors ${
                        stakes[group.groupId] === preset.value
                          ? "border-transparent bg-foreground text-card"
                          : "border-border bg-surface-2 text-muted-foreground hover:text-foreground"
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
                </div>
              </div>

              {/* Tipp leadása / módosítása + visszavonás (ikon) */}
              <div className="mt-3 flex gap-2">
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
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleCancel(group.existingBet?.id ?? "")}
                    disabled={isPending}
                    aria-label={t("cancel")}
                    className="text-faint hover:text-loss"
                  >
                    {isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <X className="size-4" />
                    )}
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
