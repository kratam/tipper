import { resolveCountryDisplay } from "@/lib/providers/team-country";
import type { Locale } from "@/lib/providers/types";

type TeamRow = { name: string; logoUrl: string | null };

/**
 * For national-team tournaments (`useFlagFallback=true`), replace the stored
 * English team name with a localized country name and fall back to a flag image
 * when no logo is present. Club/hockey tournaments (`useFlagFallback=false`) are
 * a pure NO-OP and return the row untouched.
 */
export function withTeamDisplay<T extends TeamRow>(
  team: T,
  locale: Locale,
  useFlagFallback: boolean,
): T {
  if (!useFlagFallback) return team;
  const c = resolveCountryDisplay(team.name, locale);
  if (!c) return team;
  return { ...team, name: c.name, logoUrl: team.logoUrl ?? c.flagUrl };
}

export function withMatchTeamDisplay<M extends { homeTeam: TeamRow; awayTeam: TeamRow }>(
  match: M,
  locale: Locale,
  useFlagFallback: boolean,
): M {
  return {
    ...match,
    homeTeam: withTeamDisplay(match.homeTeam, locale, useFlagFallback),
    awayTeam: withTeamDisplay(match.awayTeam, locale, useFlagFallback),
  };
}

/**
 * True when a team name is an undetermined knockout-bracket placeholder rather
 * than a real participant. odds-api returns the full bracket up front with seed
 * placeholders: group positions (`1A`, `2B`), match winners/runners-up
 * (`W73`, `RU101`), and best-third combinations (`3A/3B/3C/3D/3F`). The patterns
 * are anchored so real country and club names never match.
 */
export function isPlaceholderTeam(name: string): boolean {
  const n = name.trim();
  return /^\d+[A-Z]$/.test(n) || /^(W|RU)\d+$/.test(n) || n.includes("/");
}

/** A match is bettable only once both real participants are known. */
export function matchParticipantsKnown(homeName: string, awayName: string): boolean {
  return !isPlaceholderTeam(homeName) && !isPlaceholderTeam(awayName);
}
