import type { ReactNode } from "react";
import { TeamLogo } from "@/components/team-logo";

interface MatchScoreboardProps {
  homeTeam: { name: string; logoUrl: string | null };
  awayTeam: { name: string; logoUrl: string | null };
  /** Középső elem a két zászló közé: léptetők, eredmény vagy ÉLŐ jelzés. */
  center: ReactNode;
  /** Zászló mérete pixelben. */
  logoSize?: number;
  /**
   * Opcionális alsó sor a három oszlop alá igazítva (hazai · közép · vendég) —
   * pl. a tippelhető nézet 1/X/2 oddsai, hogy az „1" a hazai, a „2" a vendég, az
   * „X" a középső (`:`) oszlop alá kerüljön.
   */
  bottomRow?: { home: ReactNode; center: ReactNode; away: ReactNode };
}

/**
 * Vízszintes meccs-scoreboard sor: [zászló] [közép] [zászló], a csapatnevek a
 * zászlók alatt, opcionálisan egy oszlop-igazított alsó sorral (`bottomRow`).
 * A `center` slot a hívótól függ (tippelhető → léptetők, lejátszott → eredmény,
 * élő → ÉLŐ jelzés). Tisztán prezentációs, nincs üzleti logika — a BetForm és a
 * BetDialog közösen használja.
 */
export function MatchScoreboard({
  homeTeam,
  awayTeam,
  center,
  logoSize = 40,
  bottomRow,
}: MatchScoreboardProps) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center justify-items-center gap-x-6 gap-y-1.5">
      <TeamLogo name={homeTeam.name} logoUrl={homeTeam.logoUrl} size={logoSize} />
      <div className="flex items-center justify-center">{center}</div>
      <TeamLogo name={awayTeam.name} logoUrl={awayTeam.logoUrl} size={logoSize} />
      <span className="text-center font-medium text-xs leading-tight">{homeTeam.name}</span>
      <div />
      <span className="text-center font-medium text-xs leading-tight">{awayTeam.name}</span>
      {bottomRow && (
        <>
          <div className="pt-0.5">{bottomRow.home}</div>
          <div className="pt-0.5">{bottomRow.center}</div>
          <div className="pt-0.5">{bottomRow.away}</div>
        </>
      )}
    </div>
  );
}
