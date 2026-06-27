"use client";

import { ChevronDown, ChevronUp, CircleAlert, CircleCheck, Crown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { getTipMatrixRoundAction } from "@/actions/tip-matrix";
import { GroupRulesDialog } from "@/components/group-rules-dialog";
import { TipMatrix, type TipMatrixLeaderboardRow } from "@/components/tip-matrix";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePersistedDisclosure } from "@/hooks/use-persisted-disclosure";
import { Link } from "@/i18n/navigation";
import type { GroupRules } from "@/lib/group-rules";
import type { TipMatrixRound } from "@/queries/tip-matrix";

const STORAGE_KEY = "tipper:landingBoard:open";

export interface BoardTab {
  key: string;
  label: string;
  groupId: string;
  leaderboard: TipMatrixLeaderboardRow[];
  detailHref: string;
  readOnly: boolean;
  rules: GroupRules | null;
  rulesGroupName: string | null;
}

export interface TournamentBoardPanelProps {
  currentUserId: string;
  timeZone: string;
  officialRank: number | null;
  officialProfit: number;
  next3Days: { total: number; withBet: number };
  tabs: BoardTab[];
  officialInitialRound: TipMatrixRound | null;
  /** Meccs-kattintás a kurált mátrixban → a meccs-kártyával azonos popup (BetDialog). */
  onMatchSelect?: (matchId: string) => void;
  userBadges?: Record<string, Array<{ badgeKey: string; tier: number }>>;
  userStats?: Record<string, { totalBets: number; hitRate: number }>;
}

export function TournamentBoardPanel({
  currentUserId,
  timeZone,
  officialRank,
  officialProfit,
  next3Days,
  tabs,
  officialInitialRound,
  onMatchSelect,
  userBadges,
  userStats,
}: TournamentBoardPanelProps) {
  const t = useTranslations("tipMatrix");
  const tGroups = useTranslations("groups");
  const tTournaments = useTranslations("tournaments");

  const [open, , toggle] = usePersistedDisclosure(STORAGE_KEY, true);
  const [activeKey, setActiveKey] = useState(tabs[0]?.key ?? "official");
  const [roundByTab, setRoundByTab] = useState<Record<string, TipMatrixRound | null>>(
    tabs[0] ? { [tabs[0].key]: officialInitialRound } : {},
  );
  const [isPending, startTransition] = useTransition();

  // A `router.refresh()` (pl. tipp leadása után) friss `officialInitialRound`
  // propot ad, de a `roundByTab` useState csak mount-kor inicializálódik. Ezért
  // a hivatalos tab fordulóját a friss proppal szinkronban tartjuk, hogy a tipp
  // utáni frissített tábla megjelenjen. Lásd [[tip-matrix.tsx]].
  useEffect(() => {
    const k = tabs[0]?.key;
    if (!k) return;
    setRoundByTab((prev) =>
      prev[k] === officialInitialRound ? prev : { ...prev, [k]: officialInitialRound },
    );
  }, [officialInitialRound, tabs]);

  // Lusta forduló-betöltés az aktív tabhoz (a hivatalos elő van töltve).
  useEffect(() => {
    if (activeKey in roundByTab) return;
    const tab = tabs.find((x) => x.key === activeKey);
    if (!tab) return;
    let cancelled = false;
    startTransition(async () => {
      const r = await getTipMatrixRoundAction(tab.groupId, null);
      if (!cancelled) setRoundByTab((prev) => ({ ...prev, [activeKey]: r }));
    });
    return () => {
      cancelled = true;
    };
  }, [activeKey, roundByTab, tabs]);

  if (tabs.length === 0) return null;

  const rankDisplay = officialRank ? `#${officialRank}` : "—";
  const activeTab = tabs.find((x) => x.key === activeKey) ?? tabs[0];
  const activeRound = activeTab.key in roundByTab ? roundByTab[activeTab.key] : undefined;

  return (
    <div className="overflow-hidden rounded-lg border border-gold-line bg-card shadow-card">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={
          open ? tTournaments("officialRibbon.collapse") : tTournaments("officialRibbon.expand")
        }
        className="flex w-full items-center gap-3 bg-linear-to-r from-gold-soft to-transparent px-4 py-3 text-left"
      >
        <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-linear-to-br from-gold to-gold-2 text-gold-ink">
          <Crown className="size-4" />
        </span>
        <span className="font-mono text-[13.5px]">
          <span className="font-bold">{rankDisplay}</span>
          <span className="text-muted-foreground"> · </span>
          <span className="font-bold text-gold">{officialProfit}</span>
        </span>
        {next3Days.total === 0 ? (
          <span className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
            <CircleCheck className="size-3.5" />
            {tTournaments("next3Days.none")}
          </span>
        ) : next3Days.withBet === next3Days.total ? (
          <span className="flex items-center gap-1.5 text-[12.5px] text-win">
            <CircleCheck className="size-3.5" />
            {tTournaments("next3Days.progress", {
              total: next3Days.total,
              withBet: next3Days.withBet,
            })}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[12.5px] text-gold">
            <CircleAlert className="size-3.5" />
            {tTournaments("next3Days.progress", {
              total: next3Days.total,
              withBet: next3Days.withBet,
            })}
          </span>
        )}
        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-gold-line border-t px-3 py-3.5">
          {tabs.length > 1 && (
            <Tabs value={activeKey} onValueChange={setActiveKey}>
              <TabsList className="w-full">
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.key} value={tab.key}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}

          {activeRound === undefined || isPending ? (
            <p className="py-6 text-center text-muted-foreground text-sm">{t("loading")}</p>
          ) : (
            <TipMatrix
              key={activeTab.key}
              curated
              groupId={activeTab.groupId}
              currentUserId={currentUserId}
              timeZone={timeZone}
              leaderboard={activeTab.leaderboard}
              initialRound={activeRound}
              readOnly={activeTab.readOnly}
              onMatchSelect={onMatchSelect}
              userBadges={userBadges}
              userStats={userStats}
            />
          )}

          <div className="flex items-center justify-between px-1">
            <Link
              href={activeTab.detailHref}
              className="font-medium font-mono text-[12.5px] text-gold hover:underline"
            >
              {tGroups("viewDetails")} →
            </Link>
            {activeTab.rules && activeTab.rulesGroupName && (
              <GroupRulesDialog groupName={activeTab.rulesGroupName} rules={activeTab.rules} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
