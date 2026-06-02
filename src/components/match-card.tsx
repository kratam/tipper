"use client";

import { Target } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { TeamLogo } from "@/components/team-logo";
import { TokenIcon } from "@/components/token-icon";

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
  /** False for undetermined knockout placeholders (e.g. "1A", "W73") — betting is locked. */
  participantsKnown: boolean;
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

function StakePill({ bet, isFinished }: { bet: UserBet; isFinished: boolean }) {
  const net = isFinished && bet.payout != null ? bet.payout - bet.stake : null;

  const pillStyle =
    net === null
      ? "bg-surface-3 text-muted-foreground border-border"
      : net > 0
        ? "bg-win-soft text-win border-transparent"
        : net < 0
          ? "bg-loss-soft text-loss border-transparent"
          : "bg-surface-3 text-muted-foreground border-border";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] ${pillStyle}`}
    >
      <span className="font-medium">{bet.groupName}</span>
      {net !== null ? (
        <span className="font-bold">
          {bet.stake}→{net > 0 ? `+${net}` : net < 0 ? `${net}` : "±0"}
        </span>
      ) : (
        <span>{bet.stake}</span>
      )}
      <TokenIcon size={11} />
    </span>
  );
}

function BetSection({ bets, isFinished }: { bets: UserBet[]; isFinished: boolean }) {
  const first = bets[0];
  if (!first) return null;

  const isWin = first.result1x2Correct === true;
  const isLoss = first.result1x2Correct === false;

  return (
    <div className="flex flex-col items-center gap-1.5 border-border border-t pt-[9px]">
      {/* Tipp (egyszer) */}
      <span
        className={`flex items-center gap-1 font-bold font-mono text-[15px] ${
          isWin ? "text-win" : isLoss ? "text-loss line-through" : "text-foreground"
        }`}
      >
        <Target className="size-3.5" />
        {first.predictedHome} – {first.predictedAway}
      </span>

      {/* Csoport tokenek pill-ekben */}
      <div className="flex flex-wrap justify-center gap-1.5">
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
  const participantsUnknown = !match.participantsKnown;
  const hasNoBet = isScheduled && match.userBets.length === 0 && !participantsUnknown;
  const localTime = useLocalTime(match.scheduledAt, timezone);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full flex-col gap-2 rounded-lg border border-border bg-card p-[15px] text-left shadow-card transition-[transform,border-color,box-shadow] hover:-translate-y-0.5 hover:border-gold-line hover:shadow-card-hover ${
        isLive ? "border-l-[3px] border-l-loss" : hasNoBet ? "border-l-[3px] border-l-gold" : ""
      }`}
    >
      {/* ── Idő / státusz ── */}
      <div className="flex flex-col items-center leading-[1.1]">
        {isLive ? (
          <span className="inline-flex items-center gap-1.5 font-bold font-mono text-[13px] text-loss">
            <span className="tc-live-dot size-[9px] rounded-full bg-loss" />
            {t("live")}
          </span>
        ) : isFinished ? (
          <>
            <span className="font-bold font-mono text-[15px] tabular-nums">
              {match.homeScore}–{match.awayScore}
            </span>
            <span className="text-[10px] text-faint">{t("finished")}</span>
          </>
        ) : (
          <>
            {/* Primary = viewer's local time (when it differs from the venue
                tz); the venue/match time moves to the small secondary line.
                localTime is null on SSR and until mount, so the venue time is
                the deterministic fallback and there is no hydration mismatch. */}
            <span className="font-bold font-mono text-[15px] tabular-nums">
              {localTime ?? formatTime(match.scheduledAt, timezone)}
            </span>
            {localTime && (
              <span className="text-[10px] text-faint">
                {t("venueTime", { time: formatTime(match.scheduledAt, timezone) })}
              </span>
            )}
          </>
        )}
      </div>

      {/* ── Csapat-sor ── */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        {/* Hazai csapat */}
        <div className="flex min-w-0 items-center gap-2">
          <TeamLogo
            name={match.homeTeam.name}
            logoUrl={match.homeTeam.logoUrl}
            size={26}
            className="h-[19px] w-[26px] object-cover shadow-[0_0_0_1px_var(--border)]"
          />
          <span className="truncate font-semibold text-[14px]">{match.homeTeam.name}</span>
        </div>

        {/* Középső: VS (eredmény az idő-blokkban jelenik meg) */}
        <span className="text-[10px] text-faint tracking-[0.2em]">
          {isFinished || isLive ? "" : "VS"}
        </span>

        {/* Vendég csapat */}
        <div className="flex min-w-0 items-center justify-end gap-2">
          <span className="truncate font-semibold text-[14px]">{match.awayTeam.name}</span>
          <TeamLogo
            name={match.awayTeam.name}
            logoUrl={match.awayTeam.logoUrl}
            size={26}
            className="h-[19px] w-[26px] object-cover shadow-[0_0_0_1px_var(--border)]"
          />
        </div>
      </div>

      {/* ── Odds 1/X/2 (csak közelgőnél, ahogy a prototípus) ── */}
      {match.odds && isScheduled && (
        <div className="grid grid-cols-3 gap-1">
          <span className="flex items-baseline justify-center gap-1.5 rounded-[7px] bg-surface-2 py-[3px] font-mono text-[12px]">
            <span className="font-bold text-[9px] text-faint">1</span>
            <span className="font-semibold" style={{ color: oddsColor(match.odds.homeOdds) }}>
              {match.odds.homeOdds}
            </span>
          </span>
          <span className="flex items-baseline justify-center gap-1.5 rounded-[7px] bg-surface-2 py-[3px] font-mono text-[12px]">
            <span className="font-bold text-[9px] text-faint">X</span>
            <span className="font-semibold" style={{ color: oddsColor(match.odds.drawOdds) }}>
              {match.odds.drawOdds}
            </span>
          </span>
          <span className="flex items-baseline justify-center gap-1.5 rounded-[7px] bg-surface-2 py-[3px] font-mono text-[12px]">
            <span className="font-bold text-[9px] text-faint">2</span>
            <span className="font-semibold" style={{ color: oddsColor(match.odds.awayOdds) }}>
              {match.odds.awayOdds}
            </span>
          </span>
        </div>
      )}

      {/* ── Tipp-sáv ── */}
      {match.userBets.length > 0 ? (
        <BetSection bets={match.userBets} isFinished={isFinished} />
      ) : participantsUnknown ? (
        <div className="flex justify-center border-border border-t pt-[9px]">
          <span className="text-[12.5px] text-faint italic">{t("participantsUnknown")}</span>
        </div>
      ) : (
        isScheduled && (
          <div className="flex items-center justify-center gap-1 border-border border-t pt-[9px] font-semibold text-[12.5px] text-gold">
            <Target className="size-3.5" />
            {t("noBet")}
          </div>
        )
      )}
    </button>
  );
}
