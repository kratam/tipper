"use client";

import { ArrowDownToLine, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useRef, useState, useTransition } from "react";
import { getTipMatrixRoundAction } from "@/actions/tip-matrix";
import { TipMatrixBetDialog } from "@/components/tip-matrix-bet-dialog";
import { TipMatrixStatsDialog } from "@/components/tip-matrix-stats-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { predictionToneClass } from "@/lib/bet-display";
import { betNet } from "@/lib/tip-matrix";
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
}

const cellKey = (userId: string, matchId: string) => `${userId}__${matchId}`;
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export function TipMatrix({
  groupId,
  currentUserId,
  timeZone,
  leaderboard,
  initialRound,
  readOnly = false,
}: TipMatrixProps) {
  const t = useTranslations("tipMatrix");
  const format = useFormatter();
  const [isPending, startTransition] = useTransition();

  const [cache, setCache] = useState<Record<string, TipMatrixRound>>(
    initialRound ? { [initialRound.roundKey]: initialRound } : {},
  );
  const [roundKey, setRoundKey] = useState<string | null>(initialRound?.roundKey ?? null);

  const round = roundKey ? cache[roundKey] : null;

  const [stats, setStats] = useState<{
    matchId: string;
    title: string;
    isFinished: boolean;
    locked: boolean;
  } | null>(null);

  const [bet, setBet] = useState<{ matchId: string } | null>(null);

  const meRowRef = useRef<HTMLTableRowElement | null>(null);

  const betByCell = useMemo(() => {
    const map = new Map<string, TipMatrixBet>();
    for (const b of round?.bets ?? []) map.set(cellKey(b.userId, b.matchId), b);
    return map;
  }, [round]);

  if (!round) {
    return <p className="text-muted-foreground text-sm">{t("empty")}</p>;
  }

  const keys = round.orderedRoundKeys;
  const idx = keys.indexOf(round.roundKey);
  const prevKey = idx > 0 ? keys[idx - 1] : null;
  const nextKey = idx >= 0 && idx < keys.length - 1 ? keys[idx + 1] : null;

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

  const meRow = leaderboard.find((r) => r.userId === currentUserId);

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

  function renderCell(row: TipMatrixLeaderboardRow, m: TipMatrixMatch) {
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
      // own future tip
      return (
        <span className="inline-block rounded-[6px] px-[6px] py-px outline outline-[1.5px] outline-gold-line">
          <span className="block font-semibold text-gold">{pred}</span>
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

  function onMatchClick(m: TipMatrixMatch) {
    const title = `${m.homeTeam.name} – ${m.awayTeam.name}`;
    if (m.locked) {
      setStats({ matchId: m.id, title, isFinished: m.status === "finished", locked: true });
    } else if (!readOnly) {
      setBet({ matchId: m.id });
    }
  }

  return (
    <div className="rounded-[14px] border border-border bg-surface">
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
        <span className="font-semibold text-[13px] text-foreground">{round.roundLabel}</span>
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
      <div className="overflow-x-auto">
        <table className="w-max min-w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-[2] border-border border-b bg-surface-2 px-2.5 py-2 text-left text-[11px] text-muted-foreground">
                {t("player")}
              </th>
              <th className="border-border border-b bg-surface-2 px-2.5 py-2 text-[11px] text-muted-foreground">
                Σ
              </th>
              {round.matches.map((m) => (
                <th
                  key={m.id}
                  className="cursor-pointer border-border border-b bg-surface-2 px-2.5 py-2 align-bottom hover:bg-surface-3"
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
            {leaderboard.map((row) => {
              const isMe = row.userId === currentUserId;
              return (
                <tr
                  key={row.userId}
                  ref={isMe ? meRowRef : undefined}
                  className={cn(isMe && "bg-gold-soft")}
                >
                  <td
                    className={cn(
                      "sticky left-0 z-[1] border-border border-b px-2.5 py-2 text-left",
                      isMe ? "bg-surface-2" : "bg-surface",
                    )}
                  >
                    <span className={cn("flex items-center gap-2", isMe && "font-bold text-gold")}>
                      <span className="w-4 text-right text-muted-foreground">{row.rank}.</span>
                      <Avatar className="size-[22px]">
                        <AvatarImage src={row.userAvatarUrl ?? undefined} alt="" />
                        <AvatarFallback>{row.userName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="max-[560px]:hidden">{row.userName}</span>
                    </span>
                  </td>
                  <td className="border-border border-b px-2.5 py-2 text-center font-bold text-[14px] text-gold">
                    {signed(row.profit)}
                  </td>
                  {round.matches.map((m) => (
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
            })}
          </tbody>
        </table>
      </div>

      {/* Jump-to-me bar */}
      {meRow && !readOnly && (
        <div className="flex items-center gap-2.5 border-gold border-t bg-surface-2 px-3 py-2">
          <span className="font-bold text-gold">{meRow.rank}.</span>
          <span className="font-bold">{t("youName", { name: meRow.userName })}</span>
          <span className="ml-auto font-bold text-gold">{signed(meRow.profit)}</span>
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

      {stats && (
        <TipMatrixStatsDialog
          groupId={groupId}
          matchId={stats.matchId}
          title={stats.title}
          isFinished={stats.isFinished}
          locked={stats.locked}
          open={!!stats}
          onOpenChange={(o) => !o && setStats(null)}
        />
      )}

      {bet && (
        <TipMatrixBetDialog
          groupId={groupId}
          matchId={bet.matchId}
          currentUserId={currentUserId}
          timeZone={timeZone}
          open={!!bet}
          onOpenChange={(o) => !o && setBet(null)}
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
