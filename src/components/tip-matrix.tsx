"use client";

import {
  ArrowDownToLine,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Lock,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  getTipMatrixBetInfoAction,
  getTipMatrixRoundAction,
  type TipMatrixBetInfo,
} from "@/actions/tip-matrix";
import { BetDialog } from "@/components/bet-dialog";
import { LeaderboardBadges } from "@/components/leaderboard-badges";
import { TokenIcon } from "@/components/token-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "@/i18n/navigation";
import { predictionToneClass } from "@/lib/bet-display";
import { splitCuratedRows } from "@/lib/leaderboard-utils";
import { betNet, buildMatrixRows, type MatrixRowDisplay, type MatrixScope } from "@/lib/tip-matrix";
import { cn } from "@/lib/utils";
import type { TipMatrixBet, TipMatrixMatch, TipMatrixRound } from "@/queries/tip-matrix";

export interface TipMatrixLeaderboardRow {
  rank: number;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  profit: number;
}

interface TipMatrixProps {
  groupId: string;
  currentUserId: string;
  timeZone: string;
  leaderboard: TipMatrixLeaderboardRow[];
  initialRound: TipMatrixRound | null;
  readOnly?: boolean;
  curated?: boolean;
  /**
   * Ha meg van adva, meccs-kattintáskor (fejléc vagy cella) NEM a mátrix saját
   * dialógusai nyílnak, hanem ezt hívjuk a meccs id-jével — így a hívó a
   * meccs-kártyával AZONOS popupot (BetDialog) nyithatja. Megadás nélkül a
   * mátrix a saját stats/bet dialógusait használja (detail oldalak).
   */
  onMatchSelect?: (matchId: string) => void;
  userBadges?: Record<string, Array<{ badgeKey: string; tier: number }>>;
  userStats?: Record<string, { totalBets: number; hitRate: number }>;
}

const cellKey = (userId: string, matchId: string) => `${userId}__${matchId}`;
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/**
 * Avatár a játékos-oszlopban. Mobilon a nevet nem írjuk ki (helyhiány), ezért
 * az avatárra kattintva tooltipben jelenik meg a név. Controlled `open` +
 * onClick toggle — mert touch-eszközön nincs hover (lásd bet-form
 * BalanceInfoTooltip ugyanezzel a mintával).
 */
function PlayerAvatarTooltip({
  userId,
  name,
  avatarUrl,
  badges,
  stats,
}: {
  userId: string;
  name: string;
  avatarUrl: string | null;
  badges?: Array<{ badgeKey: string; tier: number }>;
  stats?: { totalBets: number; hitRate: number };
}) {
  const t = useTranslations("tipMatrix");
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
            className="inline-flex cursor-pointer rounded-full"
            aria-label={name}
          >
            <Avatar className="size-[22px]">
              <AvatarImage src={avatarUrl ?? undefined} alt="" />
              <AvatarFallback>{name.charAt(0)}</AvatarFallback>
            </Avatar>
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="flex flex-col items-center gap-1 border border-border bg-surface-2 text-foreground"
        >
          <span className="font-medium">{name}</span>
          {stats && stats.totalBets > 0 ? (
            <span className="text-[11px] text-muted-foreground">
              {t("statLine", { bets: stats.totalBets, hit: stats.hitRate })}
            </span>
          ) : null}
          {badges && badges.length > 0 ? <LeaderboardBadges badges={badges} /> : null}
          <Link
            href={`/u/${userId}`}
            onClick={() => setOpen(false)}
            className="text-[11px] text-gold hover:underline"
          >
            {t("viewProfile")}
          </Link>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function TipMatrix({
  groupId,
  currentUserId,
  timeZone,
  leaderboard,
  initialRound,
  readOnly = false,
  curated = false,
  onMatchSelect,
  userBadges,
  userStats,
}: TipMatrixProps) {
  const t = useTranslations("tipMatrix");
  const format = useFormatter();
  const [isPending, startTransition] = useTransition();

  const [cache, setCache] = useState<Record<string, TipMatrixRound>>(
    initialRound ? { [initialRound.roundKey]: initialRound } : {},
  );
  const [roundKey, setRoundKey] = useState<string | null>(initialRound?.roundKey ?? null);
  const [scope, setScope] = useState<MatrixScope>("total");
  const [gapOpen, setGapOpen] = useState(false);

  const round = roundKey ? cache[roundKey] : null;

  // A round-adat kliens-state-be (`cache`) van zárva, ezért egy sikeres tipp
  // utáni `router.refresh()` friss `initialRound` propja önmagában NEM frissíti
  // a táblát (a useState initializer csak mount-kor fut). Ezért az új
  // `initialRound` propot beolvasztjuk a cache-be, és — ha a megjelenített
  // forduló ez — a frissített tippek azonnal látszanak.
  useEffect(() => {
    if (!initialRound) return;
    setCache((c) =>
      c[initialRound.roundKey] === initialRound
        ? c
        : { ...c, [initialRound.roundKey]: initialRound },
    );
  }, [initialRound]);

  // Sikeres tipp-mutáció után az ÉPP látott fordulót töltjük újra a szerverről.
  // Ez pontosabb a router.refresh-propnál: akkor is a helyes fordulót frissíti,
  // ha a felhasználó az alap (initial) fordulóról tovább lapozott.
  const refreshCurrentRound = useCallback(() => {
    const key = roundKey;
    if (!key) return;
    startTransition(async () => {
      const data = await getTipMatrixRoundAction(groupId, key);
      if (data) setCache((c) => ({ ...c, [data.roundKey]: data }));
    });
  }, [groupId, roundKey]);

  // Meccs-kattintáskor (ha nincs onMatchSelect) a meccs-kártyával AZONOS
  // BetDialog-ot nyitjuk, lustán betöltve az adott meccs bet-infóját.
  const [betMatchId, setBetMatchId] = useState<string | null>(null);
  const [betInfo, setBetInfo] = useState<TipMatrixBetInfo | null>(null);

  const meRowRef = useRef<HTMLTableRowElement | null>(null);

  // A vízszintesen görgethető tábla látható szélessége. A "további játékos"
  // elválasztó-sor feliratát ehhez igazítjuk (sticky), hogy bármennyit
  // görgetünk jobbra/balra, a felirat középen, mindig látható maradjon.
  const [viewportW, setViewportW] = useState(0);
  const roRef = useRef<ResizeObserver | null>(null);
  const scrollRefCb = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    if (!el) return;
    setViewportW(el.clientWidth);
    const ro = new ResizeObserver(() => setViewportW(el.clientWidth));
    ro.observe(el);
    roRef.current = ro;
  }, []);

  const betByCell = useMemo(() => {
    const map = new Map<string, TipMatrixBet>();
    for (const b of round?.bets ?? []) map.set(cellKey(b.userId, b.matchId), b);
    return map;
  }, [round]);

  const displayRows = useMemo(
    () => buildMatrixRows(leaderboard, round?.bets ?? [], scope),
    [leaderboard, round, scope],
  );

  if (!round) {
    return <p className="text-muted-foreground text-sm">{t("empty")}</p>;
  }

  const keys = round.orderedRoundKeys;
  const idx = keys.indexOf(round.roundKey);
  const prevKey = idx > 0 ? keys[idx - 1] : null;
  const nextKey = idx >= 0 && idx < keys.length - 1 ? keys[idx + 1] : null;

  let roundTitle: string;
  if (round.roundKind === "group" && round.roundGroupNumber != null) {
    roundTitle = t("roundLabel", { n: round.roundGroupNumber });
  } else if (round.roundIsFinal) {
    roundTitle = t("stage.final");
  } else if (round.roundKnockoutTeams === 4) {
    roundTitle = t("stage.sf");
  } else if (round.roundKnockoutTeams === 8) {
    roundTitle = t("stage.qf");
  } else if (round.roundKnockoutTeams === 16) {
    roundTitle = t("stage.r16");
  } else {
    roundTitle = t("stage.roundOf", { n: round.roundKnockoutTeams ?? 0 });
  }

  let roundScopeLabel: string;
  if (round.roundKind === "group" && round.roundGroupNumber != null) {
    roundScopeLabel = t("shortRound", { n: round.roundGroupNumber });
  } else if (round.roundIsFinal) {
    roundScopeLabel = t("shortStage.final");
  } else if (round.roundKnockoutTeams === 4) {
    roundScopeLabel = t("shortStage.sf");
  } else if (round.roundKnockoutTeams === 8) {
    roundScopeLabel = t("shortStage.qf");
  } else {
    roundScopeLabel = `1/${(round.roundKnockoutTeams ?? 0) / 2}`;
  }

  function goToRound(key: string | null) {
    if (!key) return;
    if (cache[key]) {
      setRoundKey(key);
      return;
    }
    startTransition(async () => {
      const data = await getTipMatrixRoundAction(groupId, key);
      if (data) {
        setCache((c) => ({ ...c, [data.roundKey]: data }));
        setRoundKey(data.roundKey);
      }
    });
  }

  const meRow = displayRows.find((r) => r.userId === currentUserId);

  function headerResult(m: TipMatrixMatch) {
    if (m.status === "finished" && m.homeScore != null && m.awayScore != null) {
      return (
        <span className="font-bold text-[13px] text-gold">{`${m.homeScore}:${m.awayScore}`}</span>
      );
    }
    if (m.status === "cancelled") {
      return <span className="text-[11px] text-muted-foreground">{t("cancelled")}</span>;
    }
    if (m.locked) {
      return (
        <span className="rounded-[3px] bg-loss px-[4px] py-px text-[8px] text-white tracking-wide">
          {t("live")}
        </span>
      );
    }
    return (
      <span className="text-[11px] text-faint">
        {format.dateTime(new Date(m.scheduledAt), { timeZone, hour: "2-digit", minute: "2-digit" })}
      </span>
    );
  }

  function renderCell(row: MatrixRowDisplay, m: TipMatrixMatch) {
    const bet = betByCell.get(cellKey(row.userId, m.id));
    const isMe = row.userId === currentUserId;

    if (!bet) {
      if (m.locked) {
        return <span className="text-faint">–</span>;
      }
      // not locked, no bet: own row may bet (Phase 2), others see lock
      if (isMe && !readOnly) {
        return <span className="text-faint">+</span>;
      }
      return <Lock className="mx-auto size-3 text-faint" aria-label={t("hidden")} />;
    }

    const pred = `${bet.predictedHome}:${bet.predictedAway}`;

    if (!m.locked) {
      // own future tip — tipp + alatta a feltett tét
      return (
        <span className="flex flex-col items-center gap-[2px] leading-tight">
          <span className="inline-block rounded-[6px] px-[6px] py-px outline outline-[1.5px] outline-gold-line">
            <span className="block font-semibold text-gold">{pred}</span>
          </span>
          <span className="inline-flex items-center gap-[2px] font-medium text-[10px] text-gold-text">
            <TokenIcon size={9} />
            {bet.stake}
          </span>
        </span>
      );
    }

    const tone = predictionToneClass({
      result1x2Correct: bet.result1x2Correct,
      goalDiffCorrect: bet.goalDiffCorrect,
      exactScoreCorrect: bet.exactScoreCorrect,
      payout: bet.payout,
      stake: bet.stake,
      oddsAtBet: bet.oddsAtBet,
    });
    const net = betNet(bet.payout, bet.stake);

    return (
      <span className="flex flex-col items-center leading-tight">
        <span className={cn("text-[13px]", tone)}>{pred}</span>
        {net == null ? (
          <span className="text-[10px] text-faint">…</span>
        ) : (
          <span className={cn("text-[10px]", net >= 0 ? "text-win" : "text-loss")}>
            {signed(net)}
          </span>
        )}
      </span>
    );
  }

  const curatedSplit = curated
    ? splitCuratedRows(displayRows, currentUserId, { leaders: 3, neighbors: 1 })
    : null;
  const colCount = 2 + round.matches.length;

  function renderRow(row: MatrixRowDisplay) {
    const isMe = row.userId === currentUserId;
    return (
      <tr key={row.userId} ref={isMe ? meRowRef : undefined} className={cn(isMe && "bg-gold-soft")}>
        <td
          className={cn(
            "sticky left-0 z-[1] border-border border-b px-2.5 py-2 text-left",
            isMe ? "bg-surface-2" : "bg-surface",
          )}
        >
          <span className={cn("flex items-center gap-2", isMe && "font-bold text-gold")}>
            <span className="w-4 text-right text-muted-foreground">{row.rank}.</span>
            <PlayerAvatarTooltip
              userId={row.userId}
              name={row.userName}
              avatarUrl={row.userAvatarUrl}
              badges={userBadges?.[row.userId]}
              stats={userStats?.[row.userId]}
            />
            <span className="max-[560px]:hidden">{row.userName}</span>
          </span>
        </td>
        <td className="border-border border-b px-2.5 py-2 text-center font-bold text-[14px] text-gold">
          {signed(row.value)}
        </td>
        {round?.matches.map((m) => (
          // biome-ignore lint/a11y/useKeyWithClickEvents: table cell click is a supplemental interaction; keyboard users navigate via the stats dialog
          <td
            key={m.id}
            className="cursor-pointer border-border border-b px-2.5 py-2 text-center hover:bg-surface-3"
            onClick={() => onMatchClick(m)}
          >
            {renderCell(row, m)}
          </td>
        ))}
      </tr>
    );
  }

  // A leaders / around blokk közötti összecsukó-sor. A teljes táblát átérő
  // bg-sáv a <td>-n marad, de a felirat egy sticky, viewport-széles spanben ül,
  // így vízszintes görgetéskor is mindig a látható terület közepén marad.
  function renderGapToggle(opts: { onClick: () => void; expanded: boolean; count?: number }) {
    return (
      <tr>
        <td colSpan={colCount} className="border-border border-b bg-surface-2 p-0">
          <button
            type="button"
            onClick={opts.onClick}
            className="block w-full py-2 hover:bg-surface-3"
          >
            <span
              className={cn(
                "sticky left-0 flex w-full items-center justify-center gap-1.5 text-[12.5px]",
                opts.expanded ? "text-muted-foreground" : "text-faint",
              )}
              style={{ width: viewportW || undefined }}
            >
              {opts.expanded ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
              {opts.expanded ? t("showLess") : t("showMore", { count: opts.count ?? 0 })}
            </span>
          </button>
        </td>
      </tr>
    );
  }

  async function onMatchClick(m: TipMatrixMatch) {
    if (onMatchSelect) {
      onMatchSelect(m.id);
      return;
    }
    // Lusta betöltés: a kattintott meccs bet-infója, majd a meccs-kártyával
    // AZONOS BetDialog. (A BetDialog lejátszott/élő meccsre belül maga is
    // lazy-zi a csoport-tippeket.)
    setBetMatchId(m.id);
    setBetInfo(null);
    const info = await getTipMatrixBetInfoAction(groupId, m.id);
    setBetInfo(info);
  }

  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
      {/* Round nav */}
      <div className="flex items-center justify-between border-border border-b bg-surface-2 px-3 py-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => goToRound(prevKey)}
          disabled={!prevKey || isPending}
          aria-label={t("prevRound")}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="font-semibold text-[13px] text-foreground">{roundTitle}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => goToRound(nextKey)}
          disabled={!nextKey || isPending}
          aria-label={t("nextRound")}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Table */}
      <div
        ref={scrollRefCb}
        className={cn("overflow-x-auto", curated && gapOpen && "max-h-[60vh] overflow-y-auto")}
      >
        <table className="w-max min-w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th
                className={cn(
                  "sticky left-0 z-[2] border-border border-b bg-surface-2 px-2.5 py-2 text-left text-[11px] text-muted-foreground",
                  curated && "top-0",
                )}
              >
                {t("player")}
              </th>
              <th
                className={cn(
                  "border-border border-b bg-surface-2 p-0 text-[11px] text-muted-foreground",
                  curated && "sticky top-0 z-[1]",
                )}
              >
                <button
                  type="button"
                  onClick={() => setScope((s) => (s === "total" ? "round" : "total"))}
                  aria-pressed={scope === "round"}
                  className="flex w-full flex-col items-center px-2.5 py-2 hover:bg-surface-3"
                >
                  <span>Σ</span>
                  <span
                    className={cn(
                      "mt-1 whitespace-nowrap text-[10px]",
                      scope === "round" ? "text-gold" : "text-faint",
                    )}
                  >
                    {scope === "round" ? roundScopeLabel : t("scopeTotal")}
                  </span>
                </button>
              </th>
              {round.matches.map((m) => (
                <th
                  key={m.id}
                  className={cn(
                    "cursor-pointer border-border border-b bg-surface-2 px-2.5 py-2 align-bottom hover:bg-surface-3",
                    curated && "sticky top-0 z-[1]",
                  )}
                  onClick={() => onMatchClick(m)}
                >
                  <span className="flex justify-center gap-[5px] text-[15px] leading-none">
                    <FlagOrLogo team={m.homeTeam} />
                    <FlagOrLogo team={m.awayTeam} />
                  </span>
                  <span className="mt-1 block">{headerResult(m)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!curatedSplit ? (
              displayRows.map((row) => renderRow(row))
            ) : gapOpen ? (
              <>
                {displayRows.map((row) => renderRow(row))}
                {curatedSplit.hiddenCount > 0 &&
                  renderGapToggle({ onClick: () => setGapOpen(false), expanded: true })}
              </>
            ) : (
              <>
                {curatedSplit.leaders.map((row) => renderRow(row))}
                {curatedSplit.hiddenCount > 0 &&
                  renderGapToggle({
                    onClick: () => setGapOpen(true),
                    expanded: false,
                    count: curatedSplit.hiddenCount,
                  })}
                {curatedSplit.around.map((row) => renderRow(row))}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Jump-to-me bar */}
      {meRow && !readOnly && (
        <div className="flex items-center gap-2.5 border-gold border-t bg-surface-2 px-3 py-2">
          <span className="font-bold text-gold">{meRow.rank}.</span>
          <span className="font-bold">{t("youName", { name: meRow.userName })}</span>
          <span className="ml-auto font-bold text-gold">{signed(meRow.value)}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("jumpToMe")}
            onClick={() =>
              meRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
            }
          >
            <ArrowDownToLine className="size-4 text-gold" />
          </Button>
        </div>
      )}

      {betMatchId && betInfo && (
        <BetDialog
          match={betInfo.match}
          groups={[betInfo.group]}
          currentUserId={currentUserId}
          timeZone={timeZone}
          open={!!betMatchId}
          onBetMutated={refreshCurrentRound}
          onOpenChange={(o) => {
            if (!o) {
              setBetMatchId(null);
              setBetInfo(null);
            }
          }}
        />
      )}
    </div>
  );
}

function FlagOrLogo({ team }: { team: { name: string; logoUrl: string | null } }) {
  if (team.logoUrl) {
    return (
      // biome-ignore lint/performance/noImgElement: small inline flag/logo, no Next/Image needed
      <img src={team.logoUrl} alt={team.name} className="h-4 w-4 rounded-[2px] object-contain" />
    );
  }
  return (
    <span className="text-[10px] text-muted-foreground">{team.name.slice(0, 3).toUpperCase()}</span>
  );
}
