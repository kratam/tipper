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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getTipMatrixBetInfoAction, type TipMatrixBetInfo } from "@/actions/tip-matrix";
import { BetDialog } from "@/components/bet-dialog";
import { LeaderboardBadges } from "@/components/leaderboard-badges";
import { TokenIcon } from "@/components/token-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMatchesRaw } from "@/hooks/live/use-matches";
import { useTipMatrixRound } from "@/hooks/live/use-tip-matrix-round";
import { Link } from "@/i18n/navigation";
import { predictionToneClass } from "@/lib/bet-display";
import { getInitials } from "@/lib/initials";
import { splitCuratedRows } from "@/lib/leaderboard-utils";
import { applyLiveScores } from "@/lib/live/apply-live-scores";
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
  tournamentId: string;
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

// Üres forduló-placeholder, hogy a useTipMatrixRound hook MINDIG egy nem-null
// round-dal hívható legyen (feltétel nélküli hook-hívás), akkor is, ha az
// initialRound null. A tényleges „nincs forduló" UI-t az initialRound==null ág
// kezeli (a round végül null lesz).
const EMPTY_ROUND: TipMatrixRound = {
  roundKey: "",
  roundKind: "group",
  roundGroupNumber: null,
  roundKnockoutTeams: null,
  roundIsFinal: false,
  orderedRoundKeys: [],
  matches: [],
  bets: [],
};

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
              <AvatarFallback>{getInitials(name)}</AvatarFallback>
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
  tournamentId,
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

  // A fejléc meccs-időpontját a felhasználó SAJÁT (böngésző) időzónája szerint
  // mutatjuk, nem a verseny helyszínéé (`timeZone` prop) szerint — a játékos
  // számára az a hasznos, mikor kezdődik a meccs nála. SSR-kor a böngésző tz
  // nem ismert, ezért kezdőértékként a venue tz-t használjuk (a szerver-render
  // ezzel egyezik → nincs hydration mismatch), majd mount után átváltunk a
  // böngésző tz-re. A venue idő/eltérés a meccs-popupban (BetDialog) marad.
  const [userTimeZone, setUserTimeZone] = useState<string | null>(null);
  useEffect(() => {
    setUserTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const [roundKey, setRoundKey] = useState<string | null>(initialRound?.roundKey ?? null);
  const [scope, setScope] = useState<MatrixScope>("total");
  const [gapOpen, setGapOpen] = useState(false);

  // A forduló SZERKEZETE (ki mit tippelt) a tipMatrix query-ből; a változó
  // score/status/payout a közös `matches` query-ből, applyLiveScores-szal
  // beolvasztva → mindig konzisztens a MatchCard-dal (egyetlen igazságforrás).
  // A hookok feltétel NÉLKÜL hívódnak (EMPTY_ROUND placeholder), hogy a
  // hook-sorrend stabil legyen akkor is, ha az initialRound null.
  const baseRound = useTipMatrixRound(
    groupId,
    initialRound ?? EMPTY_ROUND,
    roundKey ?? initialRound?.roundKey ?? "",
  );
  const liveMatchData = useMatchesRaw(tournamentId);
  const round = initialRound ? applyLiveScores(baseRound, liveMatchData, currentUserId) : null;

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

  // A forduló-lapozás csak a `roundKey`-t állítja; a betöltést a
  // useTipMatrixRound hook végzi a roundKey változására (közös TanStack cache).
  function goToRound(key: string | null) {
    if (!key) return;
    setRoundKey(key);
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
    // Upcoming meccs: az idő fölé apró dátum (a játékos saját tz-e szerint,
    // ugyanúgy mint az idő). Szoros leading + a th csökkentett függőleges
    // paddingje együtt tartja a fejléc-sor magasságát ~változatlanul.
    const tz = userTimeZone ?? timeZone;
    const dt = new Date(m.scheduledAt);
    return (
      <span className="flex flex-col items-center leading-none">
        <span className="font-light text-[9px] text-faint">
          {format
            .dateTime(dt, { timeZone: tz, day: "2-digit", month: "2-digit" })
            .replace(/\s/g, "")}
        </span>
        <span className="mt-px text-[11px] text-faint">
          {format.dateTime(dt, { timeZone: tz, hour: "2-digit", minute: "2-digit" })}
        </span>
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
          disabled={!prevKey}
          aria-label={t("prevRound")}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="font-semibold text-[13px] text-foreground">{roundTitle}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => goToRound(nextKey)}
          disabled={!nextKey}
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
                  "sticky left-0 z-[2] border-border border-b bg-surface-2 px-2.5 py-1.5 text-left text-[11px] text-muted-foreground",
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
                  className="flex w-full flex-col items-center px-2.5 py-1.5 hover:bg-surface-3"
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
                    "cursor-pointer border-border border-b bg-surface-2 px-2.5 py-1.5 align-bottom hover:bg-surface-3",
                    curated && "sticky top-0 z-[1]",
                  )}
                  onClick={() => onMatchClick(m)}
                >
                  <span className="flex justify-center gap-[5px] text-[15px] leading-none">
                    <FlagOrLogo team={m.homeTeam} />
                    <FlagOrLogo team={m.awayTeam} />
                  </span>
                  <span className="mt-0.5 block">{headerResult(m)}</span>
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
