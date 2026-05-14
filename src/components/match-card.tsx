"use client";

import { Circle } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

interface MatchOdds {
  homeOdds: string;
  drawOdds: string;
  awayOdds: string;
}

interface UserBet {
  id: string;
  predictedHome: number;
  predictedAway: number;
  stake: number;
  result1x2Correct: boolean | null;
  goalDiffCorrect: boolean | null;
  exactScoreCorrect: boolean | null;
  payout: number | null;
  groupName: string;
}

export interface MatchCardData {
  id: string;
  homeTeam: { name: string; logoUrl: string | null };
  awayTeam: { name: string; logoUrl: string | null };
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  scheduledAt: string;
  round: string;
  odds: MatchOdds | null;
  userBets: UserBet[];
}

function TeamLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  if (logoUrl) {
    return (
      <Image src={logoUrl} alt={name} width={28} height={28} className="size-7 object-contain" />
    );
  }
  return (
    <span className="flex size-7 items-center justify-center rounded bg-muted font-bold font-mono text-[9px]">
      {name.slice(0, 3).toUpperCase()}
    </span>
  );
}

/**
 * Odds színkódolás: kék (alacsony/favorit) → lila → narancs (magas/esélytelen)
 * Range: ~1.20 → ~7.50
 */
function oddsColor(odds: string): string {
  const v = Number.parseFloat(odds);
  // Normalize to 0–1 range (1.2 → 0, 7.5 → 1)
  const t = Math.min(1, Math.max(0, (v - 1.2) / (7.5 - 1.2)));

  if (t < 0.5) {
    // Blue → Purple (0 → 0.5)
    const s = t / 0.5;
    const r = Math.round(96 + (167 - 96) * s);
    const g = Math.round(165 + (139 - 165) * s);
    const b = Math.round(250 + (250 - 250) * s);
    return `rgb(${r},${g},${b})`;
  }
  // Purple → Orange (0.5 → 1)
  const s = (t - 0.5) / 0.5;
  const r = Math.round(167 + (249 - 167) * s);
  const g = Math.round(139 + (115 - 139) * s);
  const b = Math.round(250 + (22 - 250) * s);
  return `rgb(${r},${g},${b})`;
}

function formatTime(dateStr: string, timeZone: string): string {
  return new Intl.DateTimeFormat("hu", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(dateStr));
}

interface MatchCardProps {
  match: MatchCardData;
  timezone: string;
  onClick: () => void;
}

function isTodayOrTomorrow(dateStr: string, timeZone: string): boolean {
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone,
    }).format(d);

  const matchDay = fmt(new Date(dateStr));
  const today = fmt(new Date());

  // Add 1 day to today
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDay = fmt(tomorrow);

  return matchDay === today || matchDay === tomorrowDay;
}

function StakePill({ bet, isFinished }: { bet: UserBet; isFinished: boolean }) {
  const isWin = bet.result1x2Correct === true;
  const isLoss = bet.result1x2Correct === false;

  const pillStyle = isWin
    ? "bg-emerald-500/10 text-emerald-600"
    : isLoss
      ? "bg-destructive/8 text-destructive"
      : "bg-muted text-muted-foreground";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] ${pillStyle}`}
    >
      <span className="font-medium">{bet.groupName}</span>
      {isFinished && isWin && bet.payout != null ? (
        <span className="font-bold">
          {bet.stake}→+{bet.payout}
        </span>
      ) : isFinished && isLoss ? (
        <span className="line-through">{bet.stake}</span>
      ) : (
        <span>{bet.stake}</span>
      )}
      🪙
    </span>
  );
}

function BetSection({ bets, isFinished }: { bets: UserBet[]; isFinished: boolean }) {
  const first = bets[0];
  if (!first) return null;

  const isWin = first.result1x2Correct === true;
  const isLoss = first.result1x2Correct === false;

  const borderColor = isWin
    ? "border-emerald-500/15"
    : isLoss
      ? "border-destructive/10"
      : "border-border";

  return (
    <div
      className={`col-span-full mt-1 flex flex-col items-center gap-1 border-t pt-1.5 ${borderColor}`}
    >
      {/* Tipp (egyszer) */}
      <span
        className={`font-mono font-semibold text-[13px] ${
          isWin ? "text-emerald-500" : isLoss ? "text-destructive line-through" : "text-foreground"
        }`}
      >
        🎯 {first.predictedHome} – {first.predictedAway}
      </span>

      {/* Csoport tokenek pill-ekben */}
      <div className="flex flex-wrap justify-center gap-1">
        {bets.map((bet) => (
          <StakePill key={bet.id} bet={bet} isFinished={isFinished} />
        ))}
      </div>
    </div>
  );
}

function useLocalTime(dateStr: string, eventTimeZone: string): string | null {
  const [localTime, setLocalTime] = useState<string | null>(null);

  useEffect(() => {
    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (userTz === eventTimeZone) return;

    const local = new Intl.DateTimeFormat("hu", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: userTz,
    }).format(new Date(dateStr));

    const event = formatTime(dateStr, eventTimeZone);
    // Only show if the formatted times actually differ
    if (local !== event) {
      setLocalTime(local);
    }
  }, [dateStr, eventTimeZone]);

  return localTime;
}

export function MatchCard({ match, timezone, onClick }: MatchCardProps) {
  const t = useTranslations("matches");
  const isFinished = match.status === "finished";
  const isLive = match.status === "live";
  const isScheduled = match.status === "scheduled";
  const hasNoBet = isScheduled && match.userBets.length === 0;
  const isUrgent = hasNoBet && isTodayOrTomorrow(match.scheduledAt, timezone);
  const localTime = useLocalTime(match.scheduledAt, timezone);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full flex-col rounded-lg border px-3 py-2.5 text-left transition-all hover:bg-accent hover:ring-1 hover:ring-foreground/15 ${
        isUrgent
          ? "border-amber-500/40 border-l-[3px] border-l-amber-500 bg-amber-100 dark:bg-amber-950/40"
          : hasNoBet
            ? "border-border border-l-[3px] border-l-amber-400 bg-card"
            : "border-border bg-card"
      }`}
    >
      <div className="grid w-full grid-cols-[1fr_auto_1fr] gap-x-2">
        {/* ── Sor 1: Idő / státusz ── */}
        <div className="col-span-full flex flex-col items-center">
          {isLive ? (
            <span className="flex items-center gap-1 font-semibold text-[10px] text-red-500 leading-none">
              <Circle className="size-1.5 animate-pulse fill-red-500 text-red-500" />
              {t("live")}
            </span>
          ) : isFinished ? (
            <span className="font-medium text-[9px] text-muted-foreground/50 uppercase leading-none tracking-wider">
              {t("finished")}
            </span>
          ) : (
            <>
              <span className="font-mono font-semibold text-sm tabular-nums leading-none">
                {formatTime(match.scheduledAt, timezone)}
              </span>
              {localTime && (
                <span className="text-[9px] text-muted-foreground/50">
                  {t("localTime", { time: localTime })}
                </span>
              )}
            </>
          )}
        </div>

        {/* ── Sor 2: Csapatok + eredmény/vs ── */}
        {/* Hazai csapat */}
        <div className="flex min-w-0 items-center gap-2 py-0.5">
          <TeamLogo name={match.homeTeam.name} logoUrl={match.homeTeam.logoUrl} />
          <span className="truncate font-medium text-sm">{match.homeTeam.name}</span>
        </div>

        {/* Középső: vs vagy eredmény */}
        <div className="flex items-center justify-center px-2">
          {isFinished || isLive ? (
            <span className="font-bold font-mono text-[22px] tabular-nums leading-tight">
              {match.homeScore}–{match.awayScore}
            </span>
          ) : (
            <span className="text-[9px] text-muted-foreground/40 tracking-[0.15em]">vs</span>
          )}
        </div>

        {/* Vendég csapat */}
        <div className="flex min-w-0 items-center justify-end gap-2 py-0.5">
          <span className="truncate font-medium text-sm">{match.awayTeam.name}</span>
          <TeamLogo name={match.awayTeam.name} logoUrl={match.awayTeam.logoUrl} />
        </div>

        {/* ── Sor 2: Odds ── */}
        {match.odds && (
          <>
            <div className="flex items-baseline gap-1 pb-0.5">
              <span className="font-semibold text-[9px] text-muted-foreground/50">1</span>
              <span
                className={`font-medium font-mono text-[11px] ${isScheduled ? "" : "text-muted-foreground/60"}`}
                style={isScheduled ? { color: oddsColor(match.odds.homeOdds) } : undefined}
              >
                {match.odds.homeOdds}
              </span>
            </div>
            <div className="flex items-baseline justify-center gap-1 pb-0.5">
              <span className="font-semibold text-[9px] text-muted-foreground/50">X</span>
              <span
                className={`font-medium font-mono text-[11px] ${isScheduled ? "" : "text-muted-foreground/60"}`}
                style={isScheduled ? { color: oddsColor(match.odds.drawOdds) } : undefined}
              >
                {match.odds.drawOdds}
              </span>
            </div>
            <div className="flex items-baseline justify-end gap-1 pb-0.5">
              <span className="font-semibold text-[9px] text-muted-foreground/50">2</span>
              <span
                className={`font-medium font-mono text-[11px] ${isScheduled ? "" : "text-muted-foreground/60"}`}
                style={isScheduled ? { color: oddsColor(match.odds.awayOdds) } : undefined}
              >
                {match.odds.awayOdds}
              </span>
            </div>
          </>
        )}

        {/* ── Sor 3: Tipp ── */}
        {match.userBets.length > 0 ? (
          <BetSection bets={match.userBets} isFinished={isFinished} />
        ) : (
          isScheduled && (
            <div
              className={`col-span-full mt-1 flex justify-center border-t pt-1.5 ${
                isUrgent ? "border-amber-500/15" : "border-border"
              }`}
            >
              <span
                className={`text-xs ${isUrgent ? "font-medium text-amber-600" : "text-muted-foreground/40"}`}
              >
                {isUrgent ? "🎯 " : ""}
                {t("noBet")}
              </span>
            </div>
          )
        )}
      </div>
    </button>
  );
}
